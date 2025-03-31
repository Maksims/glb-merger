# GLB Merger

Merges multiple avatar GLB's into a single one, with optional modifications.

Merging by **default is lossless**, and preserves all original meshes and textures.
The only modification on scene - is removing duplicate Skeletons.

**Skeleton** is now moved to root of the document, instead of a child of a node with mesh.

It also can reduce geometry for different **LoD** levels.

Additionally it can merge meshes into a **single mesh** with **atlasing textures**, in result it will be one mesh, one material and a few textures.

# Usage

```bash
node main.js --files ./path/to/file.glb --output ./path/to/output.glb
```

# Options

## --help
Print possible options.

## --files
A list of GLB files to merge.

## --output
A path for output GLB.

## --lod
Default 0.  
Possible values: 0, 1, 2 or 3.  
Reduce the geometry for different LoD levels and removes some data for higher levels. This is a lossy operation. Each level applies an additional optimizations:

0. Preserves all data and geometry.

1. Reduces geometry. Removes Mouth and BodyHair meshes. Removes Emissive texture. Atlas (when merging enabled) resolution will be 512.

2. Significantly reduces geometry. Removes Eyes mesh. Removes Normal texture. Atlas resolution will be 256.

3. Highsest geometry reduction. Atlas resolution will be 64.

## --merge
Default false.  
If enabled, then all meshes will be merged into a single one. All textures will be merged into an Atlases based on slots: base, metallic-roughness, normals, occlusion. Higher LoD levels might omit normals and occlusion altogether.

## --resize
Default false.  
Ignored if --merge is enabled.  
Risizes textures down to a maximum defined value. This operation requires a significant CPU time.

## --inspect
Default false.  
Print resulting GLBs structure: scenes, meshes, materials, textures.

# Examples

```bash
# lossless merge of GLBs
node main.js --files ./fileA.glb ./fileB.glb --output ./output.glb

# merge into single GLB with textures resizing to maximum resolution of 512
node main.js -r 512 --files ./fileA.glb ./fileB.glb --output ./output.glb

# lossy merge to a single mesh with atlasing and LoD 2 with geometry reduction
node main.js -m -l 2 --files ./fileA.glb ./fileB.glb --output ./output.glb
```