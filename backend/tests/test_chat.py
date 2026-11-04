import io
import json
import unittest
from urllib.error import HTTPError
from unittest.mock import patch

from app.services.chat import ChatRequest, GeminiError, generate_reply


class GeminiChatTests(unittest.TestCase):
    def test_sends_conversation_and_dashboard_context_without_query_key(self):
        response = io.BytesIO(json.dumps({
            "candidates": [{"content": {"parts": [{"text": "Check the filter."}]}}],
        }).encode())
        chat = ChatRequest(
            messages=[{"role": "user", "text": "Why is flow low?"}],
            telemetry={
                "mode": "live", "tds_ppm": 240, "temperature_c": 25,
                "flow_lpm": 0.1, "turbidity_ntu": None, "pump_state": "on",
                "sensor_status": {
                    "tds": "valid", "temperature": "valid", "flow": "valid",
                    "turbidity": "not_installed",
                },
            },
        )

        with patch("app.services.chat.urlopen", return_value=response) as mocked_urlopen:
            answer = generate_reply("secret-key", "gemini-test", chat)

        request = mocked_urlopen.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(answer, "Check the filter.")
        self.assertNotIn("secret-key", request.full_url)
        self.assertEqual(request.get_header("X-goog-api-key"), "secret-key")
        self.assertEqual(body["contents"][0]["role"], "user")
        self.assertIn('"flow_lpm":0.1', body["system_instruction"]["parts"][0]["text"])
        self.assertIn("Never claim water is safe", body["system_instruction"]["parts"][0]["text"])

    def test_rate_limit_has_actionable_error(self):
        error = HTTPError("https://example.test", 429, "rate limited", {}, io.BytesIO())
        with patch("app.services.chat.urlopen", side_effect=error):
            with self.assertRaises(GeminiError) as raised:
                generate_reply("secret-key", "gemini-test", ChatRequest(messages=[{"role": "user", "text": "Help"}]))
        self.assertEqual(raised.exception.status_code, 503)
        self.assertIn("rate limited", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
