// middleware/kiosk.middleware.js
const asyncHandler = require('express-async-handler');

const kioskAuth = asyncHandler(async (req, res, next) => {
  // البحث عن kioskId في الهيدر أو الـ query أو الـ body
  const kioskId =
    req.headers['kiosk'] ||   // من الهيدر: Kiosk: <id>
    req.query.kioskId ||      // من الـ query
    req.body.kioskId;         // من الـ body

  if (!kioskId) {
    res.status(401);
    throw new Error('Kiosk ID is required (header, query or body)');
  }

  // حفظ الـ kioskId للاستعمال في الـ controllers
  req.kioskId = kioskId;
  next();
});

module.exports = { kioskAuth };
