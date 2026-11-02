"""Focused preservation and rejection checks for the manual contour handoff."""
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

from editable_hero import load_editable_hero, validate_hero_document


DOCUMENT = """<Rive version="1" kind="fragment">
  <Artboard id="1:12" name="Hero" width="506" height="1060"
      defaultStateMachineId="1:140" styleId="1:502">
    <Node id="5:20" name="Head pivot">
      <Shape id="9:1" name="Front golden hair">
        <PointsPath id="9:2"><CubicDetachedVertex id="9:3" x="237" y="73" /></PointsPath>
      </Shape>
    </Node>
    <StateMachine id="1:140" name="Hero">
      <StateMachineLayer id="9:4">
        <EntryState id="9:5"><StateTransition id="9:6" stateToId="1:142" /></EntryState>
        <AnimationState id="1:142" animationId="1:141" />
      </StateMachineLayer>
    </StateMachine>
    <LinearAnimation id="1:141" name="Hero loop">
      <KeyedObject id="9:7" objectId="5:20">
        <KeyedProperty id="9:8" property="rotation">
          <KeyFrameDouble id="9:9" frame="0" value="0" />
          <KeyFrameDouble id="9:10" frame="360" value="0" />
        </KeyedProperty>
      </KeyedObject>
    </LinearAnimation>
    <LayoutComponentStyle id="1:502" />
  </Artboard>
</Rive>
"""


class EditableHeroTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        self.source = self.directory / "scene.rml"
        self.mapping = self.directory / "namespaces.json"
        self.source.write_text(DOCUMENT)

    def load(self):
        return load_editable_hero(self.source, self.mapping)

    def write(self, root):
        self.source.write_bytes(ET.tostring(root))

    def test_contour_edit_survives_repeated_load_without_source_write(self):
        root = ET.fromstring(DOCUMENT)
        root.find(".//CubicDetachedVertex").set("x", "249.75")
        self.write(root)
        edited_source = self.source.read_bytes()
        first = self.load()
        second = self.load()
        self.assertEqual(first.find(".//CubicDetachedVertex").get("x"), "249.75")
        self.assertEqual(ET.tostring(first), ET.tostring(second))
        self.assertEqual(self.source.read_bytes(), edited_source)
        self.assertEqual(first.get("id"), "101:12")
        self.assertEqual(first.find(".//CubicDetachedVertex").get("id"), "109:3")
        self.assertEqual(first.find(".//KeyedObject").get("objectId"), "105:20")
        first.find(".//CubicDetachedVertex").set("x", "0")
        self.assertEqual(second.find(".//CubicDetachedVertex").get("x"), "249.75")

    def test_new_editor_client_does_not_renumber_existing_clients(self):
        first = self.load()
        original_mapping = json.loads(self.mapping.read_text())
        root = ET.parse(self.source).getroot()
        ET.SubElement(root.find(".//PointsPath"), "CubicDetachedVertex", id="0:8", x="250", y="80")
        self.write(root)
        second = self.load()
        updated_mapping = json.loads(self.mapping.read_text())
        for client, destination in original_mapping.items():
            self.assertEqual(updated_mapping[client], destination)
        self.assertNotIn(updated_mapping["0"], original_mapping.values())
        self.assertEqual(first.get("id"), second.get("id"))
        self.assertEqual(first.find(".//KeyedObject").attrib, second.find(".//KeyedObject").attrib)
        self.assertEqual(second.find(".//PointsPath")[-1].get("id"), f'{updated_mapping["0"]}:8')

    def test_missing_reference_and_dangling_sentinel_rejected(self):
        for reference in ("88:99", "0:0"):
            with self.subTest(reference=reference):
                root = ET.fromstring(DOCUMENT)
                root.find(".//KeyedObject").set("objectId", reference)
                self.write(root)
                with self.assertRaises(ValueError):
                    self.load()
        self.assertFalse(self.mapping.exists())

    def test_other_artboard_and_external_asset_rejected(self):
        for tag in ("Artboard", "ImageAsset", "ScriptAsset"):
            with self.subTest(tag=tag):
                root = ET.fromstring(DOCUMENT)
                ET.SubElement(root, tag, id="8:1", name="Other")
                with self.assertRaises(ValueError):
                    validate_hero_document(root)

    def test_matching_component_asset_is_optional(self):
        root = ET.fromstring(DOCUMENT)
        ET.SubElement(root, "ComponentAsset", id="9:11", name="Hero", artboardId="1:12")
        self.assertEqual(validate_hero_document(root).get("name"), "Hero")
        root[-1].set("artboardId", "1:99")
        with self.assertRaises(ValueError):
            validate_hero_document(root)

    def test_internal_id_lists_are_remapped_and_missing_list_targets_rejected(self):
        root = ET.fromstring(DOCUMENT)
        # The loader preserves and remaps list syntax independently of CLI schema checks.
        root.find(".//Shape").set("tagIds", "9:2-9:3")
        self.write(root)
        self.assertEqual(self.load().find(".//Shape").get("tagIds"), "109:2-109:3")
        root.find(".//Shape").set("tagIds", "9:2-99:3")
        with self.assertRaises(ValueError):
            validate_hero_document(root)

    def test_duplicate_ids_and_namespace_collisions_rejected(self):
        root = ET.fromstring(DOCUMENT)
        root.find(".//CubicDetachedVertex").set("id", "9:2")
        with self.assertRaises(ValueError):
            validate_hero_document(root)
        self.mapping.write_text('{"1":101,"5":101,"9":109}')
        with self.assertRaises(ValueError):
            self.load()


if __name__ == "__main__":
    unittest.main()
