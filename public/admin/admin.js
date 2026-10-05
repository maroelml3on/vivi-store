const state = {
  products: [],
  orders: [],
  customers: [],
  stats: null,
  settings: {},
  currentSection: "dashboard"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(url, options = {}) {
  const response = await fetch(url, options);

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed: ${response.status}`
    );
  }

  return data;
}


/* =========================================================
   HELPERS
========================================================= */

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function formatMoney(value) {
  const number = Number(value || 0);

  return `${number.toLocaleString("ar-EG")} ${
    state.settings.currency || "جنيه"
  }`;
}


function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}


function formatDateTime(value) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function getProductStock(product) {
  return (product.colors || []).reduce(
    (sum, color) => sum + Number(color.stock || 0),
    0
  );
}


function getProductMinPrice(product) {
  const prices = (product.colors || [])
    .map(color => Number(color.price))
    .filter(price => Number.isFinite(price));

  if (!prices.length) return 0;

  return Math.min(...prices);
}


function getProductImage(product) {
  return (
    product?.colors?.[0]?.image ||
    "https://placehold.co/500x650/151515/ffffff?text=VINI"
  );
}


function getStatusLabel(status) {
  const labels = {
    new: "جديد",
    processing: "قيد التجهيز",
    shipped: "تم الشحن",
    completed: "مكتمل",
    cancelled: "ملغي"
  };

  return labels[status] || status || "جديد";
}


function getStatusClass(status) {
  const classes = {
    new: "status-new",
    processing: "status-processing",
    shipped: "status-shipped",
    completed: "status-completed",
    cancelled: "status-cancelled"
  };

  return classes[status] || "status-new";
}


function showToast(message, type = "success") {
  const toast = $("#adminToast");

  if (!toast) return;

  toast.textContent = message;

  toast.className = `admin-toast show ${type}`;

  clearTimeout(showToast.timer);

  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}


/* =========================================================
   INITIAL LOAD
========================================================= */

async function loadAll() {
  try {
    const [
      stats,
      products,
      orders,
      customers,
      settings
    ] = await Promise.all([
      api("/api/stats"),
      api("/api/products"),
      api("/api/orders"),
      api("/api/customers"),
      api("/api/settings")
    ]);

    state.stats = stats;
    state.products = products;
    state.orders = orders;
    state.customers = customers;
    state.settings = settings;

    renderAll();

  } catch (error) {
    console.error(error);

    showToast(
      `تعذر تحميل بيانات لوحة التحكم: ${error.message}`,
      "error"
    );
  }
}


function renderAll() {
  renderStats();
  renderRecentOrders();
  renderLowStock();
  renderCategoryFilter();
  renderProducts();
  renderOrders();
  renderCustomers();
}


/* =========================================================
   NAVIGATION
========================================================= */

function switchSection(section) {
  const validSections = [
    "dashboard",
    "products",
    "orders",
    "customers"
  ];

  if (!validSections.includes(section)) {
    section = "dashboard";
  }

  state.currentSection = section;

  $$(".nav-item").forEach(item => {
    item.classList.toggle(
      "active",
      item.dataset.section === section
    );
  });

  $$(".page-section").forEach(sectionElement => {
    sectionElement.classList.remove("active");
  });

  const target = $(`#${section}Section`);

  if (target) {
    target.classList.add("active");
  }

  const titles = {
    dashboard: "لوحة التحكم",
    products: "إدارة المنتجات",
    orders: "الطلبات",
    customers: "العملاء"
  };

  $("#pageTitle").textContent = titles[section] || "لوحة التحكم";

  const sidebar = $(".sidebar");

  if (sidebar) {
    sidebar.classList.remove("open");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


$$(".nav-item").forEach(item => {
  item.addEventListener("click", () => {
    switchSection(item.dataset.section);
  });
});


$$("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    switchSection(button.dataset.go);
  });
});


const mobileMenuBtn = $("#mobileMenuBtn");

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    $(".sidebar")?.classList.toggle("open");
  });
}


/* =========================================================
   STATS
========================================================= */

function renderStats() {
  const stats = state.stats || {};

  $("#statProducts").textContent =
    Number(stats.products || 0).toLocaleString("ar-EG");

  $("#statOrders").textContent =
    Number(stats.orders || 0).toLocaleString("ar-EG");

  $("#statCustomers").textContent =
    Number(stats.customers || 0).toLocaleString("ar-EG");

  $("#statRevenue").textContent =
    formatMoney(stats.revenue || 0);

  $("#statPending").textContent =
    Number(stats.pending || 0).toLocaleString("ar-EG");

  $("#statStock").textContent =
    Number(stats.totalStock || 0).toLocaleString("ar-EG");

  $("#statLowStock").textContent =
    Number(stats.lowStock || 0).toLocaleString("ar-EG");
}


/* =========================================================
   RECENT ORDERS
========================================================= */

function renderRecentOrders() {
  const container = $("#recentOrders");

  if (!container) return;

  const orders = [...state.orders]
    .sort((a, b) => {
      return new Date(b.createdAt || 0) -
             new Date(a.createdAt || 0);
    })
    .slice(0, 6);

  if (!orders.length) {
    container.innerHTML = `
      <div class="empty-state">
        لا توجد طلبات حتى الآن.
      </div>
    `;

    return;
  }

  container.innerHTML = orders.map(order => {

    const customerName =
      order.customer?.name ||
      order.customerName ||
      "عميل";

    return `
      <div class="recent-order">

        <div class="recent-order-info">

          <strong>
            ${escapeHTML(order.id || "ORDER")}
          </strong>

          <span>
            ${escapeHTML(customerName)}
            ·
            ${formatDateTime(order.createdAt)}
          </span>

        </div>

        <div class="recent-order-total">
          ${formatMoney(order.total)}
        </div>

      </div>
    `;

  }).join("");
}


/* =========================================================
   LOW STOCK
========================================================= */

function renderLowStock() {
  const container = $("#lowStockProducts");

  if (!container) return;

  const threshold =
    Number(state.settings.lowStockThreshold || 5);

  const products = state.products
    .map(product => ({
      product,
      stock: getProductStock(product)
    }))
    .filter(item => item.stock <= threshold)
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 8);

  if (!products.length) {
    container.innerHTML = `
      <div class="empty-state">
        لا توجد منتجات منخفضة المخزون.
      </div>
    `;

    return;
  }

  container.innerHTML = products.map(item => {

    const product = item.product;

    return `
      <div class="low-stock-item">

        <div class="low-stock-image">
          <img
            src="${escapeHTML(getProductImage(product))}"
            alt=""
          >
        </div>

        <div class="low-stock-info">

          <strong>
            ${escapeHTML(product.name)}
          </strong>

          <span>
            ${escapeHTML(product.category || "بدون تصنيف")}
          </span>

        </div>

        <div class="stock-number">
          ${item.stock}
        </div>

      </div>
    `;

  }).join("");
}


/* =========================================================
   PRODUCT CATEGORIES
========================================================= */

function renderCategoryFilter() {
  const select = $("#productCategoryFilter");

  if (!select) return;

  const currentValue = select.value;

  const categories = [
    ...new Set(
      state.products
        .map(product => product.category)
        .filter(Boolean)
    )
  ].sort();

  select.innerHTML = `
    <option value="">كل التصنيفات</option>

    ${categories.map(category => `
      <option value="${escapeHTML(category)}">
        ${escapeHTML(category)}
      </option>
    `).join("")}
  `;

  select.value = currentValue;
}


/* =========================================================
   PRODUCTS
========================================================= */

function renderProducts() {
  const tbody = $("#productsTableBody");

  if (!tbody) return;

  const search =
    ($("#productSearch")?.value || "")
      .trim()
      .toLowerCase();

  const category =
    $("#productCategoryFilter")?.value || "";

  const filtered = state.products.filter(product => {

    const matchesSearch =
      !search ||
      String(product.name || "")
        .toLowerCase()
        .includes(search) ||
      String(product.category || "")
        .toLowerCase()
        .includes(search);

    const matchesCategory =
      !category ||
      product.category === category;

    return matchesSearch && matchesCategory;
  });

  if (!filtered.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            لا توجد منتجات مطابقة.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = filtered.map(product => {

    const stock = getProductStock(product);

    const threshold =
      Number(state.settings.lowStockThreshold || 5);

    let stockClass = "stock-good";

    if (stock <= 0) {
      stockClass = "stock-empty";
    } else if (stock <= threshold) {
      stockClass = "stock-low";
    }

    const colorsCount =
      (product.colors || []).length;

    const image =
      getProductImage(product);

    return `
      <tr>

        <td>

          <div class="product-table-info">

            <div class="product-thumb">
              <img
                src="${escapeHTML(image)}"
                alt=""
              >
            </div>

            <div class="product-table-name">

              <strong>
                ${escapeHTML(product.name)}
              </strong>

              <span>
                ${escapeHTML(product.id || "")}
              </span>

            </div>

          </div>

        </td>


        <td>
          ${escapeHTML(product.category || "-")}
        </td>


        <td>
          ${colorsCount}
        </td>


        <td class="price-cell">
          ${formatMoney(getProductMinPrice(product))}
        </td>


        <td class="${stockClass}">
          ${stock}
        </td>


        <td>

          ${
            stock <= 0
              ? `<span class="status status-cancelled">نفد</span>`
              : stock <= threshold
                ? `<span class="status status-processing">منخفض</span>`
                : `<span class="status status-completed">متوفر</span>`
          }

        </td>


        <td>

          <div class="table-actions">

            <button
              class="table-action"
              title="تعديل"
              data-edit-product="${escapeHTML(product.id)}"
            >
              ✎
            </button>

            <button
              class="table-action danger"
              title="حذف"
              data-delete-product="${escapeHTML(product.id)}"
            >
              ×
            </button>

          </div>

        </td>

      </tr>
    `;

  }).join("");

  $$("[data-edit-product]").forEach(button => {

    button.addEventListener("click", () => {
      openProductEditor(button.dataset.editProduct);
    });

  });


  $$("[data-delete-product]").forEach(button => {

    button.addEventListener("click", () => {
      deleteProduct(button.dataset.deleteProduct);
    });

  });
}


/* PRODUCT SEARCH */

$("#productSearch")?.addEventListener(
  "input",
  renderProducts
);


$("#productCategoryFilter")?.addEventListener(
  "change",
  renderProducts
);


/* =========================================================
   PRODUCT MODAL
========================================================= */

function openProductEditor(productId = null) {

  const modal = $("#productModal");

  if (!modal) return;

  $("#productForm").reset();

  $("#productId").value = "";

  $("#colorsContainer").innerHTML = "";

  if (productId) {

    const product =
      state.products.find(
        item => item.id === productId
      );

    if (!product) return;

    $("#productModalTitle").textContent =
      "تعديل المنتج";

    $("#productId").value =
      product.id || "";

    $("#productName").value =
      product.name || "";

    $("#productCategory").value =
      product.category || "";

    $("#productDescription").value =
      product.description || "";

    $("#productFeatured").checked =
      Boolean(product.featured);

    (product.colors || []).forEach(color => {
      addColorEditor(color);
    });

  } else {

    $("#productModalTitle").textContent =
      "إضافة منتج";

    addColorEditor();

  }

  modal.classList.add("open");

  document.body.style.overflow = "hidden";
}


function closeProductModal() {

  $("#productModal")?.classList.remove("open");

  document.body.style.overflow = "";

}


$$("[data-close-modal]").forEach(element => {

  element.addEventListener(
    "click",
    closeProductModal
  );

});


$("#addProductBtn")?.addEventListener(
  "click",
  () => openProductEditor()
);


/* =========================================================
   COLOR EDITOR
========================================================= */

let colorEditorCounter = 0;

function addColorEditor(color = null) {

  colorEditorCounter++;

  const container =
    $("#colorsContainer");

  if (!container) return;

  const colorId =
    color?.id ||
    `color-${Date.now()}-${colorEditorCounter}`;

  const colorName =
    color?.name || "";

  const price =
    color?.price ?? "";

  const stock =
    color?.stock ?? "";

  const sizes =
    Array.isArray(color?.sizes)
      ? color.sizes.join(", ")
      : "";

  const image =
    color?.image || "";

  const card =
    document.createElement("div");

  card.className = "color-editor-card";

  card.dataset.colorId = colorId;

  card.innerHTML = `

    <div class="color-editor-top">

      <div class="color-number">

        <span class="color-dot"></span>

        <span>
          اللون
        </span>

      </div>

      <button
        type="button"
        class="remove-color"
        title="حذف اللون"
      >
        ×
      </button>

    </div>


    <div class="color-grid">


      <div class="form-group">

        <label>
          اسم اللون
        </label>

        <input
          type="text"
          class="color-name"
          value="${escapeHTML(colorName)}"
          placeholder="أسود"
          required
        >

      </div>


      <div class="form-group">

        <label>
          السعر
        </label>

        <input
          type="number"
          class="color-price"
          value="${escapeHTML(price)}"
          min="0"
          step="1"
          placeholder="599"
          required
        >

      </div>


      <div class="form-group">

        <label>
          المخزون
        </label>

        <input
          type="number"
          class="color-stock"
          value="${escapeHTML(stock)}"
          min="0"
          step="1"
          placeholder="20"
          required
        >

      </div>


      <div class="form-group">

        <label>
          المقاسات
        </label>

        <input
          type="text"
          class="color-sizes"
          value="${escapeHTML(sizes)}"
          placeholder="S, M, L, XL"
        >

      </div>


      <div class="form-group full">

        <label>
          رابط الصورة
        </label>

        <input
          type="url"
          class="color-image-url"
          value="${escapeHTML(image)}"
          placeholder="https://..."
        >

      </div>


      <div class="form-group full">

        <label>
          أو رفع صورة من الجهاز
        </label>

        <input
          type="file"
          class="color-image-file file-input"
          accept="image/png,image/jpeg,image/webp,image/gif"
        >

      </div>


      <div class="form-group full">

        <div class="image-preview-box">

          ${
            image
              ? `
                <img
                  class="color-image-preview"
                  src="${escapeHTML(image)}"
                  alt=""
                >
              `
              : `
                <div class="image-preview-placeholder">
                  لا توجد صورة
                </div>
              `
          }

        </div>

      </div>


    </div>
  `;

  container.appendChild(card);

  const removeButton =
    card.querySelector(".remove-color");

  removeButton.addEventListener(
    "click",
    () => {

      const cards =
        container.querySelectorAll(
          ".color-editor-card"
        );

      if (cards.length <= 1) {

        showToast(
          "يجب أن يحتوي المنتج على لون واحد على الأقل.",
          "error"
        );

        return;
      }

      card.remove();

    }
  );


  const imageURL =
    card.querySelector(".color-image-url");

  const imageFile =
    card.querySelector(".color-image-file");

  const preview =
    card.querySelector(".color-image-preview");

  const previewBox =
    card.querySelector(".image-preview-box");


  imageURL.addEventListener(
    "input",
    () => {

      const url =
        imageURL.value.trim();

      if (!url) {

        previewBox.innerHTML = `
          <div class="image-preview-placeholder">
            لا توجد صورة
          </div>
        `;

        return;
      }

      previewBox.innerHTML = `
        <img
          class="color-image-preview"
          src="${escapeHTML(url)}"
          alt=""
        >
      `;

    }
  );


  imageFile.addEventListener(
    "change",
    async () => {

      const file =
        imageFile.files?.[0];

      if (!file) return;

      try {

        showToast(
          "جاري رفع الصورة..."
        );

        const formData =
          new FormData();

        formData.append(
          "image",
          file
        );

        const result =
          await api(
            "/api/upload",
            {
              method: "POST",
              body: formData
            }
          );

        if (!result?.url) {
          throw new Error(
            "لم يتم إرجاع رابط الصورة."
          );
        }

        imageURL.value =
          result.url;

        previewBox.innerHTML = `
          <img
            class="color-image-preview"
            src="${escapeHTML(result.url)}"
            alt=""
          >
        `;

        showToast(
          "تم رفع الصورة بنجاح."
        );

      } catch (error) {

        console.error(error);

        showToast(
          `فشل رفع الصورة: ${error.message}`,
          "error"
        );

      }

    }
  );


  /* Add preview styles dynamically */

  if (!document.querySelector("#adminDynamicStyles")) {

    const style =
      document.createElement("style");

    style.id =
      "adminDynamicStyles";

    style.textContent = `

      .image-preview-box {
        min-height: 150px;
        border: 1px dashed rgba(255,255,255,0.1);
        border-radius: 10px;
        background: #090909;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .color-image-preview {
        width: 100%;
        max-height: 260px;
        object-fit: contain;
        display: block;
      }

      .image-preview-placeholder {
        color: #555;
        font-size: 10px;
      }

    `;

    document.head.appendChild(style);
  }
}


$("#addColorBtn")?.addEventListener(
  "click",
  () => addColorEditor()
);


/* =========================================================
   SAVE PRODUCT
========================================================= */

$("#productForm")?.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const productId =
      $("#productId").value.trim();

    const name =
      $("#productName").value.trim();

    const category =
      $("#productCategory").value.trim();

    const description =
      $("#productDescription").value.trim();

    const featured =
      $("#productFeatured").checked;


    if (!name || !category) {

      showToast(
        "اكتب اسم المنتج والتصنيف.",
        "error"
      );

      return;
    }


    const colorCards =
      $$("#colorsContainer .color-editor-card");


    if (!colorCards.length) {

      showToast(
        "أضف لونًا واحدًا على الأقل.",
        "error"
      );

      return;
    }


    const colors = [];

    for (const card of colorCards) {

      const colorName =
        card.querySelector(".color-name")
          .value.trim();

      const price =
        Number(
          card.querySelector(".color-price")
            .value
        );

      const stock =
        Number(
          card.querySelector(".color-stock")
            .value
        );

      const sizesRaw =
        card.querySelector(".color-sizes")
          .value;

      const image =
        card.querySelector(".color-image-url")
          .value.trim();


      if (!colorName) {

        showToast(
          "كل لون يجب أن يحتوي على اسم.",
          "error"
        );

        return;
      }


      if (!Number.isFinite(price) || price < 0) {

        showToast(
          "تأكد من سعر كل لون.",
          "error"
        );

        return;
      }


      if (!Number.isFinite(stock) || stock < 0) {

        showToast(
          "تأكد من مخزون كل لون.",
          "error"
        );

        return;
      }


      colors.push({

        id:
          card.dataset.colorId ||
          `c-${Date.now()}-${colors.length}`,

        name: colorName,

        price,

        stock,

        sizes:
          sizesRaw
            .split(",")
            .map(size => size.trim())
            .filter(Boolean),

        image:
          image ||
          "https://placehold.co/500x650/151515/ffffff?text=VINI"

      });

    }


    const payload = {

      name,

      category,

      description,

      featured,

      colors

    };


    try {

      const button =
        $("#productForm button[type='submit']");

      if (button) {
        button.disabled = true;
        button.textContent = "جاري الحفظ...";
      }


      if (productId) {

        await api(
          `/api/products/${encodeURIComponent(productId)}`,
          {
            method: "PUT",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
          }
        );

        showToast(
          "تم تحديث المنتج بنجاح."
        );

      } else {

        await api(
          "/api/products",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify(payload)
          }
        );

        showToast(
          "تمت إضافة المنتج بنجاح."
        );

      }


      closeProductModal();

      await loadAll();

    } catch (error) {

      console.error(error);

      showToast(
        `تعذر حفظ المنتج: ${error.message}`,
        "error"
      );

    } finally {

      const button =
        $("#productForm button[type='submit']");

      if (button) {

        button.disabled = false;

        button.textContent =
          "حفظ المنتج";

      }

    }

  }
);


/* =========================================================
   DELETE PRODUCT
========================================================= */

async function deleteProduct(productId) {

  const product =
    state.products.find(
      item => item.id === productId
    );

  if (!product) return;


  const confirmed =
    confirm(
      `هل تريد حذف المنتج "${product.name}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`
    );


  if (!confirmed) return;


  try {

    await api(
      `/api/products/${encodeURIComponent(productId)}`,
      {
        method: "DELETE"
      }
    );

    showToast(
      "تم حذف المنتج."
    );

    await loadAll();

  } catch (error) {

    console.error(error);

    showToast(
      `تعذر حذف المنتج: ${error.message}`,
      "error"
    );

  }
}


/* =========================================================
   ORDERS
========================================================= */

function renderOrders() {

  const tbody =
    $("#ordersTableBody");

  if (!tbody) return;


  const search =
    ($("#orderSearch")?.value || "")
      .trim()
      .toLowerCase();


  const status =
    $("#orderStatusFilter")?.value || "";


  const filtered =
    state.orders.filter(order => {

      const customerName =
        order.customer?.name ||
        order.customerName ||
        "";

      const phone =
        order.customer?.phone ||
        order.phone ||
        "";

      const id =
        order.id || "";


      const matchesSearch =
        !search ||
        String(id).toLowerCase().includes(search) ||
        String(customerName).toLowerCase().includes(search) ||
        String(phone).toLowerCase().includes(search);


      const matchesStatus =
        !status ||
        order.status === status;


      return matchesSearch && matchesStatus;

    });


  if (!filtered.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            لا توجد طلبات مطابقة.
          </div>
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    filtered.map(order => {

      const customer =
        order.customer || {};


      const customerName =
        customer.name ||
        order.customerName ||
        "عميل";


      const itemsCount =
        Array.isArray(order.items)
          ? order.items.reduce(
              (sum, item) =>
                sum + Number(item.quantity || 0),
              0
            )
          : 0;


      return `
        <tr>

          <td>
            <strong>
              ${escapeHTML(order.id || "-")}
            </strong>
          </td>


          <td>

            <div class="product-table-name">

              <strong>
                ${escapeHTML(customerName)}
              </strong>

              <span>
                ${escapeHTML(
                  customer.phone ||
                  order.phone ||
                  ""
                )}
              </span>

            </div>

          </td>


          <td>
            ${itemsCount}
          </td>


          <td class="price-cell">
            ${formatMoney(order.total)}
          </td>


          <td>
            ${formatDateTime(order.createdAt)}
          </td>


          <td>

            <select
              class="order-status-select"
              data-order-status="${escapeHTML(order.id)}"
            >

              <option
                value="new"
                ${order.status === "new" ? "selected" : ""}
              >
                جديد
              </option>

              <option
                value="processing"
                ${order.status === "processing" ? "selected" : ""}
              >
                قيد التجهيز
              </option>

              <option
                value="shipped"
                ${order.status === "shipped" ? "selected" : ""}
              >
                تم الشحن
              </option>

              <option
                value="completed"
                ${order.status === "completed" ? "selected" : ""}
              >
                مكتمل
              </option>

              <option
                value="cancelled"
                ${order.status === "cancelled" ? "selected" : ""}
              >
                ملغي
              </option>

            </select>

          </td>

        </tr>
      `;

    }).join("");


  $$(".order-status-select").forEach(select => {

    select.addEventListener(
      "change",
      async () => {

        await updateOrderStatus(
          select.dataset.orderStatus,
          select.value
        );

      }
    );

  });

  addOrderSelectStyles();
}


function addOrderSelectStyles() {

  if ($("#orderSelectStyles")) return;

  const style =
    document.createElement("style");

  style.id =
    "orderSelectStyles";

  style.textContent = `

    .order-status-select {
      min-width: 105px;
      height: 32px;
      padding: 0 8px;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.08);
      background: #171717;
      color: #aaa;
      outline: none;
      font-size: 9px;
    }

    .order-status-select:focus {
      border-color: rgba(255,255,255,0.25);
    }

  `;

  document.head.appendChild(style);
}


async function updateOrderStatus(orderId, status) {

  try {

    await api(
      `/api/orders/${encodeURIComponent(orderId)}`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          status
        })
      }
    );


    showToast(
      "تم تحديث حالة الطلب."
    );


    await loadAll();

  } catch (error) {

    console.error(error);

    showToast(
      `تعذر تحديث الطلب: ${error.message}`,
      "error"
    );

  }
}


$("#orderSearch")?.addEventListener(
  "input",
  renderOrders
);


$("#orderStatusFilter")?.addEventListener(
  "change",
  renderOrders
);


/* =========================================================
   CUSTOMERS
========================================================= */

function renderCustomers() {

  const tbody =
    $("#customersTableBody");

  if (!tbody) return;


  const search =
    ($("#customerSearch")?.value || "")
      .trim()
      .toLowerCase();


  const filtered =
    state.customers.filter(customer => {

      const name =
        customer.name || "";

      const phone =
        customer.phone || "";

      return (
        !search ||
        name.toLowerCase().includes(search) ||
        phone.toLowerCase().includes(search)
      );

    });


  if (!filtered.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            لا توجد بيانات عملاء حتى الآن.
          </div>
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    filtered.map(customer => {

      const orderCount =
        Number(
          customer.ordersCount ??
          customer.orderCount ??
          0
        );


      const spent =
        Number(
          customer.totalSpent ??
          customer.total ??
          0
        );


      return `
        <tr>

          <td>

            <div class="product-table-name">

              <strong>
                ${escapeHTML(
                  customer.name || "بدون اسم"
                )}
              </strong>

            </div>

          </td>


          <td>
            ${escapeHTML(
              customer.phone || "-"
            )}
          </td>


          <td>
            ${escapeHTML(
              customer.address || "-"
            )}
          </td>


          <td>
            ${orderCount.toLocaleString("ar-EG")}
          </td>


          <td class="price-cell">
            ${formatMoney(spent)}
          </td>


          <td>
            ${formatDate(
              customer.lastOrderAt ||
              customer.updatedAt
            )}
          </td>

        </tr>
      `;

    }).join("");
}


$("#customerSearch")?.addEventListener(
  "input",
  renderCustomers
);


/* =========================================================
   KEYBOARD
========================================================= */

document.addEventListener(
  "keydown",
  event => {

    if (event.key === "Escape") {

      closeProductModal();

      $(".sidebar")?.classList.remove("open");

    }

  }
);


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    switchSection("dashboard");

    loadAll();

  }
);
