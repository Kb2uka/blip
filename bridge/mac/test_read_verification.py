#!/usr/bin/env python3
"""Read-push acknowledgement tests; no Messages, AppleScript or real database."""
import contextlib
import importlib.machinery
import importlib.util
import io
from pathlib import Path
import unittest
from unittest.mock import patch

loader = importlib.machinery.SourceFileLoader(
    "imsg_read_verification", str(Path(__file__).with_name("imsg-read")))
spec = importlib.util.spec_from_loader(loader.name, loader)
read = importlib.util.module_from_spec(spec)
loader.exec_module(read)


class ReadVerificationTests(unittest.TestCase):
    def report(self, before, after, clicked=True):
        out, err = io.StringIO(), io.StringIO()
        code = 0
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            try:
                read.report(before, after, clicked, "Mark All as Read")
            except SystemExit as exc:
                code = exc.code
        return code, out.getvalue(), err.getvalue()

    def test_partial_progress_is_not_acknowledged(self):
        code, out, err = self.report(3, 1)
        self.assertEqual(code, 75)
        self.assertEqual(out, "")
        self.assertIn("1 still unread", err)

    def test_unavailable_verification_is_not_acknowledged(self):
        for before, after in ((3, None), (None, None), (None, 1)):
            with self.subTest(before=before, after=after):
                code, out, err = self.report(before, after)
                self.assertEqual(code, 75)
                self.assertEqual(out, "")
                self.assertTrue(err)

    def test_zero_after_click_is_acknowledged(self):
        for before in (3, None):
            with self.subTest(before=before):
                code, out, err = self.report(before, 0)
                self.assertEqual(code, 0)
                self.assertTrue(out)
                self.assertEqual(err, "")

    def test_absent_menu_is_success_only_if_database_confirms_read(self):
        self.assertEqual(self.report(1, 0, clicked=False)[0], 0)
        self.assertEqual(self.report(1, 1, clicked=False)[0], 75)

    def test_initial_zero_does_not_mask_a_later_unread(self):
        self.assertEqual(self.report(0, 1)[0], 75)
        self.assertEqual(self.report(0, 0)[0], 0)

    def test_settle_waits_through_partial_progress(self):
        with patch.object(read, "unread_on_mac", side_effect=[2, 1, 0]) as count, \
                patch.object(read.time, "sleep"):
            self.assertEqual(read.settle(3), 0)
        self.assertEqual(count.call_count, 3)

    def test_settle_allows_transient_database_failures(self):
        with patch.object(read, "unread_on_mac", side_effect=[None, 0]), \
                patch.object(read.time, "sleep"):
            self.assertEqual(read.settle(None), 0)

    def test_settle_is_bounded_and_scoped_to_the_requested_chat(self):
        with patch.object(read, "unread_on_mac", return_value=1) as count, \
                patch.object(read.time, "sleep"):
            self.assertEqual(read.settle(3, "+15551234567", tries=4), 1)
        self.assertEqual(count.call_count, 4)
        count.assert_called_with("+15551234567")

    def test_cli_mark_all_waits_for_complete_verification(self):
        out = io.StringIO()
        with patch.object(read.sys, "argv", ["imsg-read", "--all"]), \
                patch.object(read, "ensure_messages", return_value=""), \
                patch.object(read, "accessibility", return_value=""), \
                patch.object(read, "unread_on_mac", side_effect=[3, 2, 0]) as count, \
                patch.object(read, "click", return_value=(True, "")) as click, \
                patch.object(read.time, "sleep"), \
                contextlib.redirect_stdout(out):
            read.main()
        click.assert_called_once_with("Mark All as Read")
        self.assertEqual(count.call_count, 3)
        self.assertIn("0 unread", out.getvalue())


if __name__ == "__main__":
    unittest.main()
