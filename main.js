// https://github.com/donmccurdy/glTF-Transform/blob/main/packages/functions/src/document-utils.ts#L81
// https://gltf-transform.dev/modules/core/classes/Node
// https://docs.msquared.io/creation/unreal-development/features-and-tutorials/the-animated-crowd
// https://spike-mml-avatar-creator.preview.msquared.io/

import { promises as fs } from 'fs';
import { Document, NodeIO, Logger } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, unpartition, sparse, simplify, weld, flatten, getSceneVertexCount, VertexCountMethod } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { createAtlases, remapUvsToAtlas, copyTexturesToAtlases } from './atlas.js';
import { mergeDocuments, mergeSkeletons, reparentPrimitives, mergePrimitives, removePrimitivesByNaterials } from './merger.js';
import { cleanupTextures, resizeTextures } from './textures.js';
import { initializeDraco, compressGeometry } from './compression.js';
import { inspect, humanFileSize, parseArgs } from './utils.js';

const start = performance.now();

const options = await parseArgs();

const numberFormatter = new Intl.NumberFormat();


const LOD = Math.floor(options.lod);
const targetAtlasSizes = [ 2048, 512, 256, 64 ];
const targetAtlasSize = targetAtlasSizes[LOD];
const lodLevels = [ 0.001, 0.002, 0.005, 0.015 ];
const merge = options.merge;
const resize = !!options.resize;
const inspecting = options.inspect;
let textureSize = (!merge && resize) ? options.resize : 512;
let atlasWidth, tilesCount;

const params = [];
if (merge) params.push('Merging');
if (merge || resize) params.push('Resizing');
if (LOD > 0) params.push(`LoD ${LOD}`);
if (params.length) console.log(`Params: ${params.join(', ')}`);

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
await initializeDraco(io);

const documents = [ ];
let sizeBefore = 0;

for(let i = 0; i < options.files.length; i++) {
    const stats = await fs.stat(options.files[i]);
    sizeBefore += stats.size;
    documents.push(await io.read(options.files[i]));
}

console.log(`Documents: ${documents.length}`);


// new document
const main = new Document();
main.setLogger(new Logger(Logger.Verbosity.ERROR));
let material;


// root
const root = main.getRoot();
 

// main scene
const sceneMain = main.createScene('scene');


// merge documents & skeletons
mergeDocuments(main, documents);


// remove primitives
if (LOD >= 1) {
    removePrimitivesByNaterials(main, (primitive) => {
        const name = primitive.getMaterial().getName();

        if ((LOD >= 2 && name.includes('Eyes'))
            || name.includes('Teeth')
            || (name.includes('FullBody') && name.includes('Hair'))) {
            return true;
        }
    });
    await main.transform(prune());
}


// merge skeletons
mergeSkeletons(main, sceneMain, merge);


if (merge) {
    material = main.createMaterial('main');

    reparentPrimitives(main, material);

    const primitives = root.listMeshes()[0].listPrimitives();
    console.log(`Primitives: ${primitives.length}`);

    atlasWidth = Math.ceil(Math.sqrt(primitives.length));
    tilesCount = atlasWidth * atlasWidth;
    textureSize = Math.floor(targetAtlasSize / atlasWidth);

    console.log(`Atlas tiles: ${tilesCount}, size: ${atlasWidth}x${atlasWidth}, resolution: ${targetAtlasSize}x${targetAtlasSize}`);
    console.log(`Texture size: ${textureSize}`);
}


// clean up primitive attributes
const primitives = root.listMeshes()[0].listPrimitives();
let i = primitives.length;
while(i--) {
    const primitive = primitives[i];

    primitive.getAttribute('JOINTS_1')?.dispose();
    primitive.getAttribute('WEIGHTS_1')?.dispose();

    // for atlasing, remap UVs
    if (merge) {
        const uvs = primitive.getAttribute('TEXCOORD_0');
        if (uvs) remapUvsToAtlas(uvs, i, atlasWidth);
    }
}


// remove textures
console.log(`Textures: ${root.listTextures().length}`);
if (LOD > 0) {
    cleanupTextures(main, {
        normalTexture: LOD > 2 ? true : false,
        occlusionTexture: LOD > 1 ? true : false,
        emissiveTexture: true
    });
}


// update materials
const materials = root.listMaterials();
for(let i = 0; i < materials.length; i++) {
    const material = materials[i];
    material.setEmissiveFactor([ 0, 0, 0 ]);
    material.setAlphaCutoff(0);
    material.getAlphaMode('OPAQUE');
}


// resize textures
if (merge || (resize && textureSize !== 1024)) {
    console.log(`Resizing Textures: ${textureSize}x${textureSize}`);
    await resizeTextures(main, textureSize);
}


// atlases
if (merge) {
    const slots = [ 'base', 'metallic-roughness' ];
    if (LOD <= 2) slots.push('normals');
    if (LOD <= 1) slots.push('occlusion');

    // create atlases
    const atlases = createAtlases(main, targetAtlasSize, material, slots);

    // copy textures into atlases
    await copyTexturesToAtlases(main, atlases, atlasWidth, targetAtlasSize);

    // convert atlases into texture files
    for(let key in atlases) {
        await atlases[key].upload();
    }
}


// vertices count
const verticesBefore = getSceneVertexCount(sceneMain, VertexCountMethod.UPLOAD);


// LoD
if (LOD > 0) {
    await main.transform(
        weld(),
        simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: lodLevels[LOD] })
    );
}


// merge geometry
if (merge) mergePrimitives(main);


// transforms
await main.transform(unpartition());
await main.transform(prune());
await main.transform(flatten());
await main.transform(sparse({ratio: 1 / 10}));
await main.transform(weld());
if (options.draco !== null)
    await compressGeometry(main, options.draco);


if (LOD > 0) {
    const verticesAfter = getSceneVertexCount(sceneMain, VertexCountMethod.UPLOAD);
    console.log(`Vertices Reduced ${Math.round((1.0 - (verticesAfter / verticesBefore)) * 100) + '%'} from: ${numberFormatter.format(verticesBefore)} to: ${numberFormatter.format(verticesAfter)}`);
}


// write file
const glb = await io.writeBinary(main);
await fs.writeFile(options.output, glb);
const stat = await fs.stat(options.output);
const sizeAfter = stat.size;


// inspect
const data = inspect(main);


// sizes
console.log(`Sizes:`);
console.log(`    Before\t${humanFileSize(sizeBefore)}`);
console.log(`    After\t${humanFileSize(sizeAfter)}`);
console.log(`    Difference\t${-Math.floor(((sizeBefore - sizeAfter) / sizeBefore) * 100)}%`);
console.log(`    Meshes\t${humanFileSize(data.sizes.meshes)}`);
console.log(`    Textures\t${humanFileSize(data.sizes.textures)}`);
console.log(`    VRAM\t${humanFileSize(data.sizes.vram)}`);

if (inspecting) console.log(JSON.stringify(data.data, null, 4));


console.log('Elapsed:', numberFormatter.format(Math.round(performance.now() - start)) + 'ms');