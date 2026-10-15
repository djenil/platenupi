const path = require("path");
const express = require("express");
const QRCode = require("qrcode");

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/assets", express.static(path.join(__dirname, "assets")));

const UPI_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

function buildUPIUri({ pa, pn, am, tn, tr, mc }) {
  const query = new URLSearchParams();
  query.append("pa", pa.trim());

  if (pn && pn.trim()) query.append("pn", pn.trim());
  if (mc && mc.trim()) query.append("mc", mc.trim());
  if (tr && tr.trim()) query.append("tr", tr.trim());
  if (tn && tn.trim()) query.append("tn", tn.trim());

  const parsedAmt = parseFloat(am);
  if (!isNaN(parsedAmt) && parsedAmt > 0) {
    query.append("am", parsedAmt.toFixed(2));
  }

  query.append("cu", "INR");
  return `upi://pay?${query.toString()}`;
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/qr", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "generate.html"));
});

app.get("/docs", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "apidocs.html"));
});

// API

app.all("/api/qr/generate", async (req, res) => {
  try {
    const params = { ...req.query, ...req.body };
    const { pa, pn, am, tn, tr, mc } = params;

    if (!pa || !UPI_PATTERN.test(pa.trim())) {
      return res.status(400).json({
        error: "Valid Payee VPA (pa) is required (e.g. store@okhdfcbank)",
      });
    }

    const upiUri = buildUPIUri({ pa, pn, am, tn, tr, mc });

    const qrImage = await QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    res.json({
      success: true,
      upiUri,
      qrImage,
    });
  } catch (err) {
    res.status(500).json({
      error: "Failed to generate QR code",
      details: err.message,
    });
  }
});

app.get("/api/qr/image", async (req, res) => {
  try {
    const { pa, pn, am, tn, tr, mc } = req.query;

    if (!pa || !UPI_PATTERN.test(pa.trim())) {
      return res.status(400).send("Valid Payee VPA (pa) query parameter is required.");
    }

    const upiUri = buildUPIUri({ pa, pn, am, tn, tr, mc });

    res.setHeader("Content-Type", "image/png");
    await QRCode.toFileStream(res, upiUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
    });
  } catch (err) {
    res.status(500).send("Error streaming QR code image.");
  }
});

app.listen(PORT, () => {
  console.log(`Platen UPI server listening on http://localhost:${PORT}`);
});
