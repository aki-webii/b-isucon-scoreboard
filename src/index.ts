import { Context, Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { html } from "hono/html";
import { drizzle } from "drizzle-orm/d1";
import { scores } from "./schema";
import { desc, sql } from "drizzle-orm";

const teamNameMap: { [key: string]: string } = {
  // ここにチームIDとチーム名のデータを書き連ねてください
  team0: "テストチーム",
};

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

const getScoreData = (c: Context<{ Bindings: Bindings }>) => {};

app.get("/", (c) => {
  return c.html(
    html`
      <!DOCTYPE html>
      <html>
        <head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/date-fns/1.30.1/date_fns.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
          <title>B-ISUCON portal</title>
        </head>
        <body>
          <div class="grid place-items-center">
            <h2 class="text-4xl font-bold mb-4 self-start">時系列スコア</h2>
            <div style="width: 1200px;">
              <canvas id="scoreLineChart"></canvas>
            </div>
          </div>

          <div class="grid place-items-center">
            <h2 class="text-4xl font-bold mb-4 self-start">最新スコア</h2>
            <div style="width: 1200px;">
              <canvas id="latestScoreChart"></canvas>
            </div>
          </div>
        </body>

        <script>
          (function () {
            const ctx = document.getElementById("scoreLineChart");

            const chart = new Chart(ctx, {
              type: "line",
              data: {
                datasets: [],
              },
              options: {
                responsive: true,
                scales: {
                  x: {
                    type: "time",
                    time: {
                      unit: "minute",
                      displayFormats: {
                        minute: "HH:mm",
                      },
                    },
                  },
                  y: {
                    beginAtZero: true,
                  },
                },
              },
            });

            const getChartData = async () => {
              const response = await fetch("/api/scores");

              return response.json();
            };

            const redrawChart = (data) => {
              chart.data.datasets = data;
              chart.update();
            };

            let chartData = {
              latestTimestamp: 0,
              datasets: [],
            };

            setInterval(async () => {
              const data = await getChartData();
              if (data.latestTimestamp !== chartData.latestTimestamp) {
                chartData = data;
                redrawChart(data.datasets);
              }
            }, 5 * 60 * 1000);

            getChartData().then((data) => redrawChart(data.datasets));
          })();

          (function () {
            const ctx = document.getElementById("latestScoreChart");

            const chart = new Chart(ctx, {
              type: "bar",
              data: {
                labels: [],
                datasets: [],
              },
              options: {
                responsive: true,
                indexAxis: "y",
                scales: {
                  y: {
                    beginAtZero: true,
                  },
                },
                plugins: {
                  legend: {
                    display: false,
                  },
                },
              },
            });

            const getChartData = async () => {
              const response = await fetch("/api/scores/latest");

              return response.json();
            };

            const redrawChart = (labels, datasets) => {
              chart.data.labels = labels;
              chart.data.datasets = datasets;
              chart.update();
            };

            let chartData = {
              latestTimestamp: 0,
              labels: [],
              datasets: [],
            };

            setInterval(async () => {
              const data = await getChartData();
              if (data.latestTimestamp !== chartData.latestTimestamp) {
                chartData = data;
                redrawChart(data.labels, data.datasets);
              }
            }, 5 * 60 * 1000);

            getChartData().then((data) => redrawChart(data.labels, data.datasets));
          })();
        </script>
      </html>
    `
  );
});

app.get("/api/scores", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select().from(scores).all();
  console.log(result);

  type ScoreChartRecord = {
    x: number;
    y: Number;
  };

  let latestTimestamp = 0;
  const scoreSets: {
    [key: string]: ScoreChartRecord[];
  } = {};
  result.forEach((scoreRecord) => {
    if (!scoreSets[scoreRecord.teamId]) {
      scoreSets[scoreRecord.teamId] = [];
    }
    scoreSets[scoreRecord.teamId].push({
      x: scoreRecord.registeredAt,
      y: scoreRecord.score,
    });

    if (latestTimestamp < scoreRecord.registeredAt) {
      latestTimestamp = scoreRecord.registeredAt;
    }
  });

  const datasets = [];
  for (let [key, value] of Object.entries(scoreSets)) {
    datasets.push({
      label: teamNameMap[key],
      data: value,
      borderWidth: 1,
    });
  }

  console.log(JSON.stringify(datasets, null, 2))


  return c.json({
    latestTimestamp,
    datasets,
  });
});

app.get("/api/scores/latest", async (c) => {
  const db = drizzle(c.env.DB);
  const result = await db.select({
    teamId: scores.teamId,
    score: scores.score,
    maxRegisteredAt: sql`max(${scores.registeredAt})`
  }).from(scores).groupBy(scores.teamId).orderBy(desc(scores.score)).all();

  console.log(JSON.stringify(result, null, 2))

  const labels = result.map((record) => teamNameMap[record.teamId]);
  const data = result.map((record) => record.score);
  const latestTimestamp = result.map((record) => record.maxRegisteredAt).reduce((a, b) => Math.max(a as number, b as number), 0);

  return c.json({
    latestTimestamp,
    labels,
    datasets: [
      {
        data: data,
        backgroundColor: [
          "rgba(255, 99, 132, 0.2)",
          "rgba(255, 159, 64, 0.2)",
          "rgba(255, 205, 86, 0.2)",
          "rgba(75, 192, 192, 0.2)",
          "rgba(54, 162, 235, 0.2)",
          "rgba(153, 102, 255, 0.2)",
          "rgba(201, 203, 207, 0.2)",
        ],
        borderColor: [
          "rgb(255, 99, 132)",
          "rgb(255, 159, 64)",
          "rgb(255, 205, 86)",
          "rgb(75, 192, 192)",
          "rgb(54, 162, 235)",
          "rgb(153, 102, 255)",
          "rgb(201, 203, 207)",
        ],
        borderWidth: 1,
      },
    ],
  });
});

app.post(
  "/api/scores",
  zValidator(
    "json",
    z.object({
      teamId: z.string(),
      score: z.number(),
    })
  ),
  async (c) => {
    // スコアフリーズ時はこの実装を有効にする。
    // c.status(201);
    // return c.body(null);

    const requestBody = c.req.valid('json');

    const db = drizzle(c.env.DB);
    await db.insert(scores).values({
      teamId: requestBody.teamId,
      score: requestBody.score,
      registeredAt: Date.now(),
    });

    c.status(201);
    return c.body(null);
  }
);

export default app;
