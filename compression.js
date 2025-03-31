import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';


export const initializeDraco = async (io) => {
    io.registerDependencies({
        'draco3d.encoder': await draco3d.createEncoderModule()
    });
};


export const compressGeometry = async (document, level) => {
    level = Math.max(0, Math.min(10, level));
    await document.transform(draco({
        method: 'edgebreaker',
        encodeSpeed: 10 - level,
        decodeSpeed: 10 - level
    }));
};