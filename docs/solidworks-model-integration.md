# Using your SolidWorks model in the Digital twin

The placeholder is a labelled schematic. It shows the water path order from your CAD brief and nothing else. It is not your product's shape.

## 1. Get a GLB out of SolidWorks

Browsers cannot open `.SLDPRT` or `.SLDASM`. The route depends on your SolidWorks version, so check what yours offers. The usual options:

- **Direct glTF/GLB export** if your version has it (File > Save As, look for `.glb` or `.gltf`).
- **STEP to GLB**: export `FiltraVyn_Main_Assembly.STEP` (already in your CAD README's output list), then convert with Blender (File > Import > STEP via a STEP add-on, then File > Export > glTF 2.0 > GLB) or another converter.

Before exporting:

- Keep **part names** meaningful: `Diaphragm_Pump_Envelope`, `Filter_Housing`, `Flow_Sensor`, `Measurement_Cell`, `Raw_Water_Tank`. Your CAD brief's assembly tree already uses these.
- Keep the model in millimetres or metres. The viewer rescales it to fit.
- Remove fasteners and tiny parts if the file is large. Aim for under about 20 MB.
- Check that parts are not merged into one mesh. A merged mesh cannot be mapped per component.

## 2. Try it quickly

Open **Digital twin**, choose your `.glb`. The page lists every mesh name it found. This does not survive a reload.

## 3. Keep it

1. Copy the file to `frontend/public/models/filtravyn.glb`.
2. Edit `frontend/public/models/model.config.json`:

```json
{
  "asset": "/models/filtravyn.glb",
  "mapping": {
    "tank": ["Tank_Body"],
    "pump": ["Diaphragm_Pump_Envelope"],
    "filter": ["Filter_Housing", "Sediment_Cartridge_Envelope"],
    "flowSensor": ["Flow_Sensor"],
    "cell": ["Measurement_Cell", "TDS_Probe", "NTC_Temperature_Probe"],
    "outlet": ["Outlet_Tubing"]
  },
  "pipeRoute": null
}
```

3. Reload. Mapped meshes glow green, amber, red or stay neutral according to the component's state. Unmapped parts keep their own colours.

Component ids: `tank`, `pump`, `filter`, `flowSensor`, `cell`, `outlet`. The names must match exactly.

## What is deliberately not guessed

- **Water flow animation** is off on your model. It only runs on the placeholder. A flow path through the real geometry needs a mapped route, and `pipeRoute` is reserved for that. Until it is implemented, nothing is drawn through your model.
- **Hotspot labels** are not placed on your model, because placement on real geometry needs reliable anchors. Selection works through the component chips.
- **Turbidity** stays unavailable regardless of the model.

## Where the code lives

- `frontend/src/features/digital-twin/Twin.tsx` — scene, placeholder, GLB loader and tinting.
- `frontend/src/app/ModelContext.tsx` — config and upload handling.
- `frontend/src/data/components.ts` — component ids, names and fact text shown in the info panel.
- `frontend/src/services/componentState.ts` — how telemetry becomes a state per component.
