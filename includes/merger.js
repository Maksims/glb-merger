import { PropertyType } from '@gltf-transform/core';
import { prune, unpartition, flatten } from '@gltf-transform/functions';
import { mergeDocuments as gltfMergeDocuments, joinPrimitives } from '@gltf-transform/functions';


const slots = [
    'body',
    'hair',
    'bottom',
    'feet',
    'top'
];


export const mergeDocuments = (document, documents) => {
    for(let i = 0; i < documents.length; i++) {
        gltfMergeDocuments(document, documents[i]);
    }
};


export const mergeSkeletons = (document, sceneMain, merge) => {
    const root = document.getRoot();
    const scenes = root.listScenes();
    let skinMain = null;

    // for each scene
    let i = scenes.length;
    while(i--) {
        const scene = scenes[i];
        if (scene === sceneMain) continue; // skip main scene

        const children = scene.listChildren();
        let c = children.length;

        while(c--) {
            const child = children[c];

            if (!skinMain) {
                // if skeleton not yet copied
                const skin = child.getSkin();
                if (skin) {
                    // copy skeleton to root of a scene
                    skinMain = skin;
                    const skeleton = skin.getSkeleton();
                    sceneMain.addChild(skeleton.listChildren()[0]);
                    skin.setSkeleton(null);
                }
            } else {
                // for evey other scene, re-assign skin to main single one
                const skin = child.getSkin();
                if (skin) {
                    skin.dispose();
                    child.setSkin(skinMain);
                    skin.setSkeleton(null);
                }
            }

            // name
            const mesh = child.getMesh();
            if (mesh) {
                child.setName(mesh.getName());
            } else {
                child.setName('node');
            }

            // copy nodes to main scene
            sceneMain.addChild(child);
        }

        scene.dispose();
    }
};


export const reparentPrimitives = (document, material) => {
    let result = [ ];
    const root = document.getRoot();
    const meshes = root.listMeshes();

    let i = meshes.length;
    while(i--) {
        const meshPrimitives = meshes[i].listPrimitives();
        for(let p = 0; p < meshPrimitives.length; p++) {
            // let skip = false;
            const primitive = meshPrimitives[p];

            if (!primitive.materialOld)
                primitive.materialOld = primitive.getMaterial();

            // const materialName = primitive.materialOld.getName();
            // if (materialName.indexOf('_Eyes_') !== -1)
            //     skip = true;

            primitive.setMaterial(material);
            
            if (i > 0) {
                // if (!skip) {
                    meshes[0].addPrimitive(primitive);
                    result.push(primitive);
                // }
                meshes[i].removePrimitive(primitive);
                
                const parents = meshes[i].listParents();
                for(let k = 0; k < parents.length; k++) {
                    if (parents[k].propertyType === PropertyType.NODE) {
                        parents[k].dispose();
                    }
                }
                
                meshes[i].dispose();
            }
        }
    }

    return result;
};


export const mergePrimitives = (document) => {
    const root = document.getRoot();
    const meshes = root.listMeshes();
    const primitives = meshes[0].listPrimitives();
    const primitiveMain = joinPrimitives(primitives);

    let i = primitives.length;
    while(i--) {
        primitives[i].dispose();
    }
    meshes[0].addPrimitive(primitiveMain);
};


export const removePrimitivesByNaterials = (document, fn) => {
    const root = document.getRoot();
    const meshes = root.listMeshes();
    let removed = 0;

    let m = meshes.length;
    while(m--) {
        const primitives = meshes[m].listPrimitives();
        let p = primitives.length;
        while(p--) {
            const primitive = primitives[p];
            if (fn(primitive)) {
                meshes[m].removePrimitive(primitive);
                primitive.dispose();
                removed++;
            }
        }
    }

    if (removed) console.log(`Removed Primitives: ${removed}`);
};