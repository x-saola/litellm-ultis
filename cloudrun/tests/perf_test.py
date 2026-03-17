"""Performance tests using Locust.

Run with:
    uv run locust -f tests/perf_test.py --headless -u 50 -r 10 --run-time 60s --host http://localhost:8080

Or open the Locust web UI:
    uv run locust -f tests/perf_test.py --host http://localhost:8080
"""
from locust import HttpUser, task, between


# Replace with a real short-lived Google Identity token when running against a live deployment.
FAKE_TOKEN = "Bearer eyJGAKE.TOKEN.FOR_LOAD_TEST"


class GatewayUser(HttpUser):
    """Simulates a user requesting a LiteLLM key."""

    wait_time = between(0.5, 2.0)

    @task(1)
    def health_check(self):
        self.client.get("/healthz")

    @task(5)
    def request_key(self):
        with self.client.post(
            "/key",
            headers={"Authorization": FAKE_TOKEN},
            catch_response=True,
        ) as response:
            if response.status_code in (200, 401, 403):
                # 401/403 are expected when token is fake — treat as success for load testing
                response.success()
            else:
                response.failure(f"Unexpected status: {response.status_code}")
