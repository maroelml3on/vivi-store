const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const session = require("express-session");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const OWNER_USERNAME =
  process.env.OWNER_USERNAME || "";

const OWNER_PASSWORD =
  process.env.OWNER_PASSWORD || "";

const SESSION_SECRET =
  process.env.SESSION_SECRET || "";

if (
  !OWNER_USERNAME ||
  !OWNER_PASSWORD ||
  !SESSION_SECRET
) {
  console.error(
    "Owner authentication environment variables are missing."
  );

  process.exit(1);
}

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const UPLOADS_DIR = path.join(ROOT, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");

for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const defaultDB = {
  settings: {
    storeName: "VINI",
    currency: "جنيه",
    lowStockThreshold: 5
  },

  products: [],

  orders: [],

  customers: []
};

function ensureDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(defaultDB, null, 2),
      "utf8"
    );
  }
}

function readDB() {
  ensureDB();

  try {
    return JSON.parse(
      fs.readFileSync(DB_FILE, "utf8")
    );
  } catch (error) {
    console.error("Database error:", error);

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(defaultDB, null, 2),
      "utf8"
    );

    return JSON.parse(
      JSON.stringify(defaultDB)
    );
  }
}

function writeDB(db) {
  fs.writeFileSync(
    DB_FILE,
    JSON.stringify(db, null, 2),
    "utf8"
  );
}

function makeId(prefix = "") {
  return (
    prefix +
    crypto.randomBytes(6).toString("hex")
  );
}

app.use(
  express.json({
    limit: "5mb"
  })
);

app.use(
  express.urlencoded({
    extended: true
  })
);

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, UPLOADS_DIR);
  },

  filename(req, file, cb) {
    const ext =
      path.extname(
        file.originalname
      ).toLowerCase();

    const allowed = [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".gif"
    ];

    const safeExt =
      allowed.includes(ext)
        ? ext
        : ".jpg";

    cb(
      null,
      `${Date.now()}-${crypto
        .randomBytes(5)
        .toString("hex")}${safeExt}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 8 * 1024 * 1024
  },

  fileFilter(req, file, cb) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(
        new Error(
          "Only image files are allowed"
        )
      );
    }

    cb(null, true);
  }
});

app.use(
  "/uploads",
  express.static(UPLOADS_DIR)
);

/* =========================
   PUBLIC AUTH PAGE
========================= */

app.get("/admin/login.html", (req, res) => {
  res.sendFile(
    path.join(
      PUBLIC_DIR,
      "admin",
      "login.html"
    )
  );
});

/* =========================
   PROTECTED ADMIN ASSETS
========================= */

app.use(
  "/admin",
  (req, res, next) => {

    if (
      req.path === "/login.html"
    ) {
      return next();
    }

    if (
      req.session &&
      req.session.owner === true
    ) {
      return next();
    }

    return res.redirect("/admin/login.html");
  },
  express.static(
    path.join(
      PUBLIC_DIR,
      "admin"
    ),
    {
      index: false
    }
  )
);

/* =========================
   PUBLIC WEBSITE
========================= */

app.use(
  express.static(PUBLIC_DIR)
);


/* =========================
   STORE
========================= */


/* =========================
   OWNER AUTH
========================= */

function requireOwner(req, res, next) {
  if (req.session && req.session.owner === true) {
    return next();
  }

  return res.status(401).json({
    error: "غير مصرح — يجب تسجيل الدخول كمالك"
  });
}

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== OWNER_USERNAME ||
    password !== OWNER_PASSWORD
  ) {
    return res.status(401).json({
      error: "اسم المستخدم أو كلمة المرور غير صحيحة"
    });
  }

  req.session.owner = true;
  req.session.username = OWNER_USERNAME;

  res.json({
    success: true,
    username: OWNER_USERNAME
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  if (req.session && req.session.owner === true) {
    return res.json({
      authenticated: true,
      username: req.session.username
    });
  }

  res.status(401).json({
    authenticated: false
  });
});

app.get("/api/store", (req, res) => {
  const db = readDB();

  res.json({
    settings: db.settings,
    products: db.products
  });
});


/* =========================
   PRODUCTS
========================= */

app.get("/api/products", (req, res) => {
  const db = readDB();

  res.json(db.products);
});


app.post("/api/products", requireOwner, (req, res) => {
  const db = readDB();

  const {
    name,
    category,
    description,
    featured,
    colors
  } = req.body;

  if (!name || !category) {
    return res.status(400).json({
      error:
        "اسم المنتج والقسم مطلوبان"
    });
  }

  const product = {
    id: makeId("p_"),
    name: String(name).trim(),
    category: String(category).trim(),
    description:
      String(description || "").trim(),
    featured: Boolean(featured),
    colors:
      Array.isArray(colors)
        ? colors
        : []
  };

  db.products.unshift(product);

  writeDB(db);

  res.status(201).json(product);
});


app.put(
  "/api/products/:id",
  requireOwner,
  (req, res) => {
    const db = readDB();

    const index =
      db.products.findIndex(
        product =>
          product.id === req.params.id
      );

    if (index === -1) {
      return res.status(404).json({
        error:
          "المنتج غير موجود"
      });
    }

    const old =
      db.products[index];

    db.products[index] = {
      ...old,
      ...req.body,
      id: old.id,
      name:
        String(
          req.body.name ??
          old.name
        ).trim(),
      category:
        String(
          req.body.category ??
          old.category
        ).trim(),
      description:
        String(
          req.body.description ??
          old.description ??
          ""
        ).trim(),
      featured:
        Boolean(
          req.body.featured ??
          old.featured
        ),
      colors:
        Array.isArray(req.body.colors)
          ? req.body.colors
          : old.colors
    };

    writeDB(db);

    res.json(
      db.products[index]
    );
  }
);


app.delete(
  "/api/products/:id",
  requireOwner,
  (req, res) => {
    const db = readDB();

    const exists =
      db.products.some(
        product =>
          product.id ===
          req.params.id
      );

    if (!exists) {
      return res.status(404).json({
        error:
          "المنتج غير موجود"
      });
    }

    db.products =
      db.products.filter(
        product =>
          product.id !==
          req.params.id
      );

    writeDB(db);

    res.json({
      success: true
    });
  }
);


/* =========================
   IMAGE UPLOAD
========================= */

app.post(
  "/api/upload",
  requireOwner,
  upload.single("image"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error:
          "لم يتم اختيار صورة"
      });
    }

    res.json({
      success: true,
      url:
        `/uploads/${req.file.filename}`
    });
  }
);


/* =========================
   ORDERS
========================= */

app.get("/api/orders", requireOwner, (req, res) => {
  const db = readDB();

  const orders =
    [...db.orders].sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

  res.json(orders);
});


app.post("/api/orders", (req, res) => {
  const db = readDB();

  const {
    customer,
    items,
    total,
    address,
    paymentMethod,
    notes
  } = req.body;

  if (
    !customer ||
    !customer.name ||
    !customer.phone ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return res.status(400).json({
      error:
        "بيانات الطلب غير مكتملة"
    });
  }

  /* Check stock */

  for (const item of items) {

    const product =
      db.products.find(
        p =>
          p.id === item.productId
      );

    if (!product) {
      return res.status(400).json({
        error:
          `المنتج غير موجود: ${item.name}`
      });
    }

    const color =
      product.colors.find(
        c =>
          c.id === item.colorId
      );

    if (!color) {
      return res.status(400).json({
        error:
          `اللون غير موجود: ${item.name}`
      });
    }

    if (
      Number(color.stock) <
      Number(item.quantity)
    ) {
      return res.status(400).json({
        error:
          `الكمية غير متوفرة: ${item.name}`
      });
    }
  }

  /* Decrease stock */

  for (const item of items) {

    const product =
      db.products.find(
        p =>
          p.id === item.productId
      );

    const color =
      product.colors.find(
        c =>
          c.id === item.colorId
      );

    color.stock =
      Number(color.stock) -
      Number(item.quantity);
  }


  const order = {
    id:
      `VINI-${Date.now()
        .toString()
        .slice(-8)}`,

    customer: {
      name:
        String(
          customer.name
        ).trim(),

      phone:
        String(
          customer.phone
        ).trim()
    },

    items,

    total:
      Number(total || 0),

    address:
      String(
        address || ""
      ).trim(),

    paymentMethod:
      paymentMethod ||
      "الدفع عند الاستلام",

    notes:
      String(
        notes || ""
      ).trim(),

    status:
      "جديد",

    createdAt:
      new Date().toISOString()
  };


  db.orders.push(order);


  /* Customers */

  const existing =
    db.customers.find(
      customer =>
        customer.phone ===
        order.customer.phone
    );

  if (existing) {

    existing.name =
      order.customer.name;

    existing.orders =
      Number(existing.orders || 0) +
      1;

    existing.totalSpent =
      Number(
        existing.totalSpent || 0
      ) +
      order.total;

    existing.lastOrder =
      order.createdAt;

  } else {

    db.customers.push({

      id:
        makeId("cus_"),

      name:
        order.customer.name,

      phone:
        order.customer.phone,

      orders:
        1,

      totalSpent:
        order.total,

      lastOrder:
        order.createdAt

    });

  }


  writeDB(db);

  res.status(201).json(order);
});


app.put(
  "/api/orders/:id",
  requireOwner,
  (req, res) => {

    const db = readDB();

    const order =
      db.orders.find(
        o =>
          o.id === req.params.id
      );

    if (!order) {
      return res.status(404).json({
        error:
          "الطلب غير موجود"
      });
    }

    if (req.body.status) {
      order.status =
        req.body.status;
    }

    writeDB(db);

    res.json(order);
  }
);


/* =========================
   CUSTOMERS
========================= */

app.get(
  "/api/customers",
  (req, res) => {

    const db = readDB();

    res.json(db.customers);
  }
);


/* =========================
   STATS
========================= */

app.get(
  "/api/stats",
  (req, res) => {

    const db = readDB();

    const revenue =
      db.orders
        .filter(
          order =>
            order.status !==
            "ملغي"
        )
        .reduce(
          (sum, order) =>
            sum +
            Number(
              order.total || 0
            ),
          0
        );


    const pending =
      db.orders.filter(
        order =>
          order.status ===
            "جديد" ||
          order.status ===
            "قيد التجهيز"
      ).length;


    let totalStock = 0;
    let lowStock = 0;


    for (
      const product
      of db.products
    ) {

      for (
        const color
        of product.colors || []
      ) {

        const stock =
          Number(
            color.stock || 0
          );

        totalStock += stock;

        if (
          stock <=
          Number(
            db.settings
              .lowStockThreshold ||
            5
          )
        ) {
          lowStock++;
        }

      }

    }


    res.json({

      products:
        db.products.length,

      orders:
        db.orders.length,

      customers:
        db.customers.length,

      revenue,

      pending,

      totalStock,

      lowStock

    });

  }
);


/* =========================
   SETTINGS
========================= */

app.get(
  "/api/settings",
  (req, res) => {

    const db = readDB();

    res.json(
      db.settings
    );

  }
);


app.put(
  "/api/settings",
  requireOwner,
  (req, res) => {

    const db = readDB();

    db.settings = {
      ...db.settings,
      ...req.body
    };

    writeDB(db);

    res.json(
      db.settings
    );

  }
);


/* =========================
   ADMIN
========================= */

app.get(
  "/admin",
  (req, res) => {

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "admin",
        "index.html"
      )
    );

  }
);


/* =========================
   ERROR
========================= */

app.use(
  (err, req, res, next) => {

    console.error(err);

    res.status(500).json({
      error:
        err.message ||
        "حدث خطأ في السيرفر"
    });

  }
);


/* =========================
   START
========================= */

ensureDB();

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("================================");
  console.log("       VINI STORE ONLINE");
  console.log("================================");
  console.log(`Store: http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log("================================");
  console.log("");
});
