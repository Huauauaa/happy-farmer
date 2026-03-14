import { Button, Card, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';

type HealthResponse = {
  ok: boolean;
  service: string;
};

function App() {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/health');
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = (await response.json()) as HealthResponse;
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchHealth();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <Card className="mx-auto max-w-2xl shadow-sm">
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          Happy Farmer
        </Typography.Title>
        <Typography.Paragraph>
          Frontend stack: React + TypeScript + Ant Design + Tailwind CSS
        </Typography.Paragraph>
        <Typography.Paragraph>
          Backend health:
          {loading ? (
            <Tag color="processing" className="ml-2">
              checking
            </Tag>
          ) : error ? (
            <Tag color="error" className="ml-2">
              {error}
            </Tag>
          ) : (
            <Tag color={health?.ok ? 'success' : 'warning'} className="ml-2">
              {health?.service ?? 'unknown'}
            </Tag>
          )}
        </Typography.Paragraph>
        <div className="flex gap-3">
          <Button type="primary" loading={loading} onClick={() => void fetchHealth()}>
            Retry health check
          </Button>
          <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">
            Tailwind Button
          </button>
        </div>
      </Card>
    </main>
  );
}

export default App;
