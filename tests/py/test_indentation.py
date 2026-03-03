import unittest

from packages.py.pdl.pdl import render


class TestIndentation(unittest.TestCase):
    def lines(self, s):
        return s.split("\n")

    def test_if_basic(self):
        out = render('[if:ok]\n  The text.\n[if-end]', {"ok": True})["markdown"]
        self.assertEqual(self.lines(out), ["The text."])

    def test_nested_if(self):
        out = render('[if:ok]\n  The text.\n  [if:ok]\n    Another text.\n  [if-end]\n[if-end]', {"ok": True})["markdown"]
        self.assertEqual(self.lines(out), ["The text.", "Another text."])

    def test_mixed_indent(self):
        out = render('[if:ok]\n      Line A\n        Line B\n[if-end]', {"ok": True})["markdown"]
        self.assertEqual(self.lines(out), ["    Line A", "      Line B"])

    def test_tabs(self):
        out = render('\t[if:ok]\n\t  Text\n\t[if-end]', {"ok": True})["markdown"]
        self.assertEqual(self.lines(out), ["Text"])

    def test_blank_preserved(self):
        out = render('[if:ok]\n  Line A\n  \n  Line B\n[if-end]', {"ok": True})["markdown"]
        self.assertEqual(self.lines(out), ["Line A", "", "Line B"])

    def test_loop(self):
        out = render('[loop:items as=x]\n    - [value:x]\n[loop-end]', {"items": ["A"]})["markdown"]
        self.assertEqual(self.lines(out), ["  - A"])


if __name__ == "__main__":
    unittest.main()
