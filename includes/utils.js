import { promises as fs } from 'fs';
import commandLineArgs from 'command-line-args';
import { inspect as gltfInspect } from "@gltf-transform/functions";


export const humanFileSize = (bytes, dp = 2) => {
    const thresh = 1024;
  
    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
  
    const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    let u = -1;
    const r = 10**dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);

    return bytes.toFixed(dp) + ' ' + units[u];
};


export const printNode = (node, depth) => {
    const padding = depth ? ''.padStart(depth * 4, '-') : '';
    console.log(padding + node.getName());

    const children = node.listChildren();
    for(let i = 0; i < children.length; i++) {
        printNode(children[i], depth + 1);
    }
};


export const nextPoT = (n) => {
    const power = Math.ceil(Math.log2(n));
    return 2 ** power;
};


export const inspect = (document) => {
    const data = gltfInspect(document);

    let sizes = {
        total: 0,
        meshes: 0,
        textures: 0,
        vram: 0
    };

    for(let i = 0; i < data.meshes.properties.length; i++)
        sizes.meshes += data.meshes.properties[i].size;
    
    for(let i = 0; i < data.textures.properties.length; i++) {
        sizes.textures += data.textures.properties[i].size;
        sizes.vram += data.textures.properties[i].gpuSize;
    }

    sizes.total += sizes.meshes;
    sizes.total += sizes.textures;

    return { data: data, sizes: sizes };
};


export const parseArgs = async () => {
    const options = commandLineArgs([{
        name: 'help',
        alias: 'h',
        verbose: true,
        type: Boolean,
        defaultValue: false
    }, {
        name: 'files',
        alias: 'f',
        multiple: true,
        type: String
    }, {
        name: 'output',
        alias: 'o',
        type: String
    }, {
        name: 'lod',
        alias: 'l',
        type: Number,
        defaultValue: 0
    }, {
        name: 'merge',
        alias: 'm',
        verbose: true,
        type: Boolean,
        defaultValue: false
    }, {
        name: 'resize',
        alias: 'r',
        type: Number,
        defaultValue: null
    }, {
        name: 'draco',
        alias: 'd',
        type: Number,
        defaultValue: null
    }, {
        name: 'inspect',
        alias: 'i',
        verbose: true,
        type: Boolean,
        defaultValue: false
    }]);

    if (options.help || process.argv.length <= 2) {
        console.log('CLI tool for merging various GLBs into single one with list of options:');
        console.log('    --files\tList of GLB files to merge. Mandatory.');
        console.log('    --output\tPath for a output GLB file. Mandatory.');
        console.log('    --lod\t0, 1, 2 or 3 - Level of Detail. It will reduce number of triangles based on selected option. Default 0.');
        console.log('    --merge\tMerges all meshes into a single one and textures into a single atlas per slot type. Default false.');
        console.log('    --resize\tResize all textures to a maximum resolution. If not set will not resize. If --merge is set, resolution will be selected based on LoD level. Default null.');
        console.log('    --draco\tCompress geometry with Draco. The value is 0..10, where 10 - is highest compression level. Default null.')
        console.log('    --inspect\tPrint GLB structure at the end. Default false.');
        process.exit(0);
    }
    
    if (!options.files) {
        console.warn('Please provide --files to merge');
        process.exit(0);
    } else {
        for(let i = 0; i < options.files.length; i++) {
            await fs.stat(options.files[i]);
        }
    }

    if (!options.output) {
        console.warn('Please provide --output path for glb');
        process.exit(0);
    }
    
    if (options.lod < 0 || options.lod > 3) {
        console.warn('--lod should be 0, 1, 2, or 3');
        process.exit(0);
    }

    return options;
};