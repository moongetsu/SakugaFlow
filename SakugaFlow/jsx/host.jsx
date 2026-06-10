function importSakugaboruFile(filePath) {
  app.beginUndoGroup("Import SakugaFlow Clip");

  try {
    if (!app.project) {
      app.newProject();
    }

    var file = new File(filePath);

    if (!file.exists) {
      app.endUndoGroup();
      return "File not found: " + filePath;
    }

    var importOptions = new ImportOptions(file);

    if (!importOptions.canImportAs(ImportAsType.FOOTAGE)) {
      app.endUndoGroup();
      return "After Effects could not import this file.";
    }

    importOptions.importAs = ImportAsType.FOOTAGE;

    var footage = app.project.importFile(importOptions);
    var comp = app.project.activeItem;

    if (comp && comp instanceof CompItem) {
      var layer = comp.layers.add(footage);
      layer.startTime = comp.time;

      app.endUndoGroup();
      return "Imported to the active timeline.";
    }

    app.endUndoGroup();
    return "Imported to the Project Panel. Open a composition to add it to the timeline.";
  } catch (err) {
    app.endUndoGroup();
    return "After Effects error: " + err.toString();
  }
}

function pingSakugaboruHost() {
  return "host/host.jsx loaded.";
}

function sakugaflowJsonEscape(value) {
  value = String(value || "");
  value = value.replace(/\\/g, "\\\\");
  value = value.replace(/\"/g, "\\\"");
  value = value.replace(/\r/g, "\\r");
  value = value.replace(/\n/g, "\\n");
  return value;
}

function sakugaflowJson(ok, message, filePath, name) {
  return "{" +
    "\"ok\":" + (ok ? "true" : "false") + "," +
    "\"message\":\"" + sakugaflowJsonEscape(message) + "\"," +
    "\"filePath\":\"" + sakugaflowJsonEscape(filePath) + "\"," +
    "\"name\":\"" + sakugaflowJsonEscape(name) + "\"" +
  "}";
}

function sakugaflowGetFileFromProjectItem(item) {
  try {
    if (!item) {
      return null;
    }

    if (item instanceof FootageItem && item.mainSource && item.mainSource.file) {
      return item.mainSource.file;
    }
  } catch (err) {}

  return null;
}

function getSelectedSakugaflowLayerFile() {
  try {
    if (!app.project) {
      return sakugaflowJson(false, "No After Effects project is open.", "", "");
    }

    var activeItem = app.project.activeItem;

    if (activeItem && activeItem instanceof CompItem && activeItem.selectedLayers && activeItem.selectedLayers.length > 0) {
      for (var i = 0; i < activeItem.selectedLayers.length; i++) {
        var layer = activeItem.selectedLayers[i];

        if (layer && layer.source) {
          var layerFile = sakugaflowGetFileFromProjectItem(layer.source);

          if (layerFile && layerFile.exists) {
            return sakugaflowJson(true, "Selected composition layer found.", layerFile.fsName, layer.source.name || layer.name || "AE clip");
          }
        }
      }

      return sakugaflowJson(false, "The selected layer is not a video footage file. Select a footage/video layer, not a text/solid/precomp layer.", "", "");
    }

    if (app.project.selection && app.project.selection.length > 0) {
      for (var j = 0; j < app.project.selection.length; j++) {
        var item = app.project.selection[j];
        var itemFile = sakugaflowGetFileFromProjectItem(item);

        if (itemFile && itemFile.exists) {
          return sakugaflowJson(true, "Selected Project panel footage found.", itemFile.fsName, item.name || "AE clip");
        }
      }

      return sakugaflowJson(false, "The selected Project panel item is not a video footage file.", "", "");
    }

    return sakugaflowJson(false, "Select a video layer in the active composition, then click Add Selected AE Clip.", "", "");
  } catch (err) {
    return sakugaflowJson(false, "After Effects error: " + err.toString(), "", "");
  }
}
