import { listTextureSlots, textureCompress } from '@gltf-transform/functions';


export const cleanupTextures = (document, slotsToRemove) => {
    // remove textures
    const textures = document.getRoot().listTextures();
    let t = textures.length;
    while(t--) {
        const texture = textures[t];
        const slots = listTextureSlots(texture);
        if (slots.length === 1 && slotsToRemove[slots[0]]) {
            texture.dispose();
        }
    }
};


export const resizeTextures = async (document, size) => {
    // texture resizer
    await document.transform(textureCompress({
        resize: [ size, size ]
    }));
};
