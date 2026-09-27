const express = require("express");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

app.disable("x-powered-by");

app.use(express.static(ROOT, {
  extensions: ["html"],
  index: "index.html"
}));

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "CalcWorld"
  });
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Not found" });
  }
  return res.status(404).send("Page not found");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`CalcWorld running on port ${PORT}`);
});