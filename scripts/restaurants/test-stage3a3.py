"""Local source-parser regression tests; uses already downloaded source files."""
import copy, importlib.util, unittest
from pathlib import Path
from unittest.mock import patch
p=Path(__file__).with_name('convert-stage3a3.py')
spec=importlib.util.spec_from_file_location('convert3',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);m.c.RETRIEVED='2026-09-09'
class SourceRegression(unittest.TestCase):
 def test_reviewed_names_and_values(self):
  rows=m.hama();corrected=[r for r in rows if any('補正行' in n for n in r['notes'])]
  self.assertEqual(len(corrected),3);self.assertEqual([r['calories'] for r in corrected],[168,157,164])
  self.assertTrue(all(not r['name'].endswith('))') for r in corrected))
 def test_new_pdf_requires_review(self):
  with patch.object(m.c,'filehash',return_value='changed'),patch.object(m.c,'tables',return_value=[]):
   with self.assertRaisesRegex(ValueError,'PDF changed'):m.hama()
 def test_changed_overflow_cell_stops(self):
  pages=copy.deepcopy(m.c.tables('stage3a3/hama'))
  row=next(r for r in pages[4]['tables'][0] if r[2]=='カイ1カ68)');row[2]='カイ1カ69)'
  with patch.object(m.c,'tables',return_value=pages):
   with self.assertRaises(ValueError):m.hama()
 def test_missing_correction_cell_stops(self):
  pages=copy.deepcopy(m.c.tables('stage3a3/hama'))
  row=next(r for r in pages[4]['tables'][0] if r[2]=='カイ1カ68)');row[2]='168'
  with patch.object(m.c,'tables',return_value=pages):
   with self.assertRaisesRegex(ValueError,'correction cells changed'):m.hama()
if __name__=='__main__':unittest.main()
