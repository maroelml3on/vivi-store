/* =========================================================
   VINI — MAIN STORE JAVASCRIPT
========================================================= */

const state = {
    products: [],
    settings: {
        storeName: "VINI",
        currency: "جنيه",
        lowStockThreshold: 5
    },

    cart: JSON.parse(localStorage.getItem("vini_cart") || "[]"),

    selectedProduct: null,
    selectedColor: null,
    selectedSize: null,
    selectedQuantity: 1,

    activeCategory: "all",
    search: ""
};


/* =========================================================
   DOM
========================================================= */

const productsGrid = document.getElementById("productsGrid");
const emptyProducts = document.getElementById("emptyProducts");

const searchInput = document.getElementById("searchInput");
const categoryFilters = document.getElementById("categoryFilters");

const productModal = document.getElementById("productModal");
const modalProductImage = document.getElementById("modalProductImage");
const modalProductCategory = document.getElementById("modalProductCategory");
const modalProductName = document.getElementById("modalProductName");
const modalProductPrice = document.getElementById("modalProductPrice");
const modalProductDescription = document.getElementById("modalProductDescription");

const colorOptions = document.getElementById("colorOptions");
const sizeOptions = document.getElementById("sizeOptions");

const selectedColorName = document.getElementById("selectedColorName");
const selectedSizeName = document.getElementById("selectedSizeName");

const productQuantity = document.getElementById("productQuantity");
const stockMessage = document.getElementById("stockMessage");

const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartItems = document.getElementById("cartItems");
const cartEmpty = document.getElementById("cartEmpty");
const cartFooter = document.getElementById("cartFooter");
const cartTotal = document.getElementById("cartTotal");
const cartCount = document.getElementById("cartCount");

const checkoutModal = document.getElementById("checkoutModal");
const checkoutForm = document.getElementById("checkoutForm");
const checkoutItemsCount = document.getElementById("checkoutItemsCount");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutMessage = document.getElementById("checkoutMessage");
const placeOrderButton = document.getElementById("placeOrderButton");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");


/* =========================================================
   HELPERS
========================================================= */

function money(value) {
    const amount = Number(value || 0);

    return `${amount.toLocaleString("ar-EG")} ${state.settings.currency || "جنيه"}`;
}


function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function saveCart() {
    localStorage.setItem(
        "vini_cart",
        JSON.stringify(state.cart)
    );
}


function showToast(message) {
    if (!toast || !toastMessage) return;

    toastMessage.textContent = message;

    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2800);
}


function lockBody() {
    document.body.classList.add("modal-open");
}


function unlockBodyIfPossible() {
    const productOpen = !productModal.hidden;
    const checkoutOpen = !checkoutModal.hidden;
    const cartOpen = cartDrawer.classList.contains("open");

    if (!productOpen && !checkoutOpen && !cartOpen) {
        document.body.classList.remove("modal-open");
    }
}


/* =========================================================
   API
========================================================= */

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
   LOAD STORE
========================================================= */

async function loadStore() {
    try {

        const data = await api("/api/store");

        state.products = Array.isArray(data.products)
            ? data.products
            : [];

        state.settings = {
            ...state.settings,
            ...(data.settings || {})
        };

        renderCategories();
        renderProducts();
        renderCart();

    } catch (error) {

        console.error("Store loading error:", error);

        productsGrid.innerHTML = `
            <div class="loading-state">
                <p>
                    حدث خطأ أثناء تحميل المتجر.
                </p>

                <button
                    class="button button-dark"
                    onclick="loadStore()"
                    style="margin-top:15px">
                    إعادة المحاولة
                </button>
            </div>
        `;

        showToast("تعذر تحميل المنتجات");

    }
}


/* =========================================================
   CATEGORIES
========================================================= */

function renderCategories() {

    const categories = [
        ...new Set(
            state.products
                .map(product => product.category)
                .filter(Boolean)
        )
    ];

    categoryFilters.innerHTML = `
        <button
            class="category-button ${state.activeCategory === "all" ? "active" : ""}"
            data-category="all">
            الكل
        </button>
    `;

    categories.forEach(category => {

        const button = document.createElement("button");

        button.className =
            `category-button ${
                state.activeCategory === category
                    ? "active"
                    : ""
            }`;

        button.dataset.category = category;

        button.textContent = category;

        categoryFilters.appendChild(button);

    });
}


/* =========================================================
   FILTER PRODUCTS
========================================================= */

function getVisibleProducts() {

    const search = state.search
        .trim()
        .toLowerCase();

    return state.products.filter(product => {

        const matchesCategory =
            state.activeCategory === "all" ||
            product.category === state.activeCategory;

        const searchableText = [
            product.name,
            product.category,
            product.description
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesSearch =
            !search ||
            searchableText.includes(search);

        return matchesCategory && matchesSearch;

    });
}


/* =========================================================
   PRODUCT CARD
========================================================= */

function getMainColor(product) {

    if (!product.colors || !product.colors.length) {
        return null;
    }

    return product.colors[0];
}


function getColorDot(colorName) {

    const name = String(colorName || "").toLowerCase();

    if (
        name.includes("أسود") ||
        name.includes("اسود") ||
        name.includes("black")
    ) {
        return "#111";
    }

    if (
        name.includes("أبيض") ||
        name.includes("ابيض") ||
        name.includes("white")
    ) {
        return "#fff";
    }

    if (
        name.includes("رمادي") ||
        name.includes("gray") ||
        name.includes("grey")
    ) {
        return "#888";
    }

    if (
        name.includes("بيج") ||
        name.includes("beige")
    ) {
        return "#c6b79f";
    }

    if (
        name.includes("أحمر") ||
        name.includes("احمر") ||
        name.includes("red")
    ) {
        return "#9d2424";
    }

    if (
        name.includes("أزرق") ||
        name.includes("ازرق") ||
        name.includes("blue")
    ) {
        return "#315a88";
    }

    if (
        name.includes("أخضر") ||
        name.includes("اخضر") ||
        name.includes("green")
    ) {
        return "#4d684d";
    }

    return "#777";
}


function productCard(product) {

    const mainColor = getMainColor(product);

    if (!mainColor) {
        return "";
    }

    const colors = product.colors || [];

    const image =
        mainColor.image ||
        "https://via.placeholder.com/1000x1200?text=VINI";

    const colorsHTML = colors
        .slice(0, 5)
        .map(color => `
            <span
                class="color-dot"
                title="${escapeHTML(color.name)}"
                style="background:${getColorDot(color.name)}">
            </span>
        `)
        .join("");

    return `
        <article
            class="product-card"
            data-product-id="${escapeHTML(product.id)}">

            <div
                class="product-image-wrap"
                data-product="${escapeHTML(product.id)}">

                ${
                    product.featured
                        ? `
                            <span class="product-badge">
                                FEATURED
                            </span>
                        `
                        : ""
                }

                <img
                    class="product-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    loading="lazy">

                <button
                    type="button"
                    class="product-quick-view"
                    data-view-product="${escapeHTML(product.id)}">

                    عرض التفاصيل

                </button>

            </div>

            <div class="product-info">

                <div class="product-category">
                    ${escapeHTML(product.category || "")}
                </div>

                <h3 class="product-name">
                    ${escapeHTML(product.name)}
                </h3>

                <div class="product-bottom">

                    <strong class="product-price">
                        ${money(mainColor.price)}
                    </strong>

                    <div class="product-colors">
                        ${colorsHTML}
                    </div>

                </div>

            </div>

        </article>
    `;
}


/* =========================================================
   RENDER PRODUCTS
========================================================= */

function renderProducts() {

    const products = getVisibleProducts();

    if (!products.length) {

        productsGrid.innerHTML = "";

        emptyProducts.hidden = false;

        return;
    }

    emptyProducts.hidden = true;

    productsGrid.innerHTML =
        products.map(productCard).join("");
}


/* =========================================================
   OPEN PRODUCT
========================================================= */

function openProduct(productId) {

    const product = state.products.find(
        item => item.id === productId
    );

    if (!product) return;

    if (!product.colors || !product.colors.length) {
        showToast("هذا المنتج لا يحتوي على ألوان متاحة");
        return;
    }

    state.selectedProduct = product;
    state.selectedColor = product.colors[0];
    state.selectedSize =
        product.colors[0].sizes?.[0] || null;
    state.selectedQuantity = 1;

    updateProductModal();

    productModal.hidden = false;

    lockBody();
}


function updateProductModal() {

    const product = state.selectedProduct;
    const color = state.selectedColor;

    if (!product || !color) return;

    modalProductImage.src =
        color.image ||
        "https://via.placeholder.com/1000x1200?text=VINI";

    modalProductImage.alt =
        `${product.name} - ${color.name}`;

    modalProductCategory.textContent =
        product.category || "";

    modalProductName.textContent =
        product.name || "";

    modalProductPrice.textContent =
        money(color.price);

    modalProductDescription.textContent =
        product.description || "";

    selectedColorName.textContent =
        color.name || "";

    selectedSizeName.textContent =
        state.selectedSize || "اختر مقاسًا";

    productQuantity.textContent =
        state.selectedQuantity;

    renderColorOptions();
    renderSizeOptions();
    updateStockMessage();

}


/* =========================================================
   COLOR OPTIONS
========================================================= */

function renderColorOptions() {

    const product = state.selectedProduct;

    if (!product) return;

    colorOptions.innerHTML =
        (product.colors || [])
            .map(color => {

                const active =
                    state.selectedColor?.id === color.id;

                return `
                    <button
                        type="button"
                        class="color-option ${active ? "active" : ""}"
                        data-color-id="${escapeHTML(color.id)}">

                        ${escapeHTML(color.name)}

                    </button>
                `;

            })
            .join("");
}


/* =========================================================
   SIZE OPTIONS
========================================================= */

function renderSizeOptions() {

    const color = state.selectedColor;

    if (!color) return;

    const sizes = color.sizes || [];

    if (!sizes.length) {

        sizeOptions.innerHTML = `
            <span style="color:var(--muted);font-size:12px">
                لا توجد مقاسات محددة
            </span>
        `;

        return;
    }

    sizeOptions.innerHTML =
        sizes
            .map(size => {

                const active =
                    state.selectedSize === size;

                return `
                    <button
                        type="button"
                        class="size-option ${active ? "active" : ""}"
                        data-size="${escapeHTML(size)}">

                        ${escapeHTML(size)}

                    </button>
                `;

            })
            .join("");
}


/* =========================================================
   STOCK
========================================================= */

function updateStockMessage() {

    const color = state.selectedColor;

    if (!color) return;

    const stock = Number(color.stock || 0);

    if (stock <= 0) {

        stockMessage.textContent =
            "هذا اللون غير متوفر حاليًا.";

        stockMessage.style.color =
            "var(--danger)";

        return;
    }

    if (
        stock <=
        Number(state.settings.lowStockThreshold || 5)
    ) {

        stockMessage.textContent =
            `متبقي ${stock} فقط`;

        stockMessage.style.color =
            "var(--danger)";

        return;
    }

    stockMessage.textContent =
        `متوفر — ${stock} قطعة`;

    stockMessage.style.color =
        "var(--success)";
}


/* =========================================================
   CLOSE PRODUCT
========================================================= */

function closeProductModal() {

    productModal.hidden = true;

    state.selectedProduct = null;
    state.selectedColor = null;
    state.selectedSize = null;

    unlockBodyIfPossible();
}


/* =========================================================
   CART
========================================================= */

function cartItemKey(item) {

    return [
        item.productId,
        item.colorId,
        item.size
    ].join("_");
}


function getCartCount() {

    return state.cart.reduce(
        (total, item) =>
            total + Number(item.quantity || 0),
        0
    );
}


function getCartTotal() {

    return state.cart.reduce(
        (total, item) =>
            total +
            Number(item.price || 0) *
            Number(item.quantity || 0),
        0
    );
}


function addToCart() {

    const product = state.selectedProduct;
    const color = state.selectedColor;
    const size = state.selectedSize;
    const quantity = Number(state.selectedQuantity || 1);

    if (!product || !color) {
        showToast("اختر المنتج أولًا");
        return;
    }

    if (!size) {
        showToast("اختر المقاس أولًا");
        return;
    }

    const stock = Number(color.stock || 0);

    if (stock <= 0) {
        showToast("هذا اللون غير متوفر حاليًا");
        return;
    }

    const key = cartItemKey({
        productId: product.id,
        colorId: color.id,
        size
    });

    const existing = state.cart.find(
        item => cartItemKey(item) === key
    );

    if (existing) {

        if (existing.quantity + quantity > stock) {
            showToast(`المتاح فقط ${stock} قطعة`);
            return;
        }

        existing.quantity += quantity;

    } else {

        if (quantity > stock) {
            showToast(`المتاح فقط ${stock} قطعة`);
            return;
        }

        state.cart.push({
            productId: product.id,
            colorId: color.id,

            name: product.name,
            color: color.name,
            size,

            quantity,
            price: Number(color.price || 0),

            image:
                color.image ||
                ""
        });

    }

    saveCart();
    renderCart();

    closeProductModal();

    showToast("تمت إضافة المنتج إلى السلة");

    openCart();

}


/* =========================================================
   RENDER CART
========================================================= */

function renderCart() {

    const count = getCartCount();
    const total = getCartTotal();

    cartCount.textContent = count;

    cartTotal.textContent =
        money(total);

    checkoutItemsCount.textContent =
        count;

    checkoutTotal.textContent =
        money(total);

    if (!state.cart.length) {

        cartItems.innerHTML = "";

        cartEmpty.style.display = "flex";
        cartFooter.style.display = "none";

        return;
    }

    cartEmpty.style.display = "none";
    cartFooter.style.display = "block";

    cartItems.innerHTML =
        state.cart
            .map((item, index) => {

                return `
                    <div class="cart-item">

                        <img
                            class="cart-item-image"
                            src="${escapeHTML(item.image || "https://via.placeholder.com/200")}"
                            alt="${escapeHTML(item.name)}">

                        <div class="cart-item-info">

                            <div class="cart-item-name">
                                ${escapeHTML(item.name)}
                            </div>

                            <div class="cart-item-meta">
                                ${escapeHTML(item.color)}
                                ·
                                ${escapeHTML(item.size)}
                            </div>

                            <div class="cart-item-price">
                                ${money(item.price)}
                            </div>

                            <div class="cart-item-controls">

                                <button
                                    type="button"
                                    data-cart-minus="${index}">
                                    −
                                </button>

                                <span>
                                    ${item.quantity}
                                </span>

                                <button
                                    type="button"
                                    data-cart-plus="${index}">
                                    +
                                </button>

                            </div>

                        </div>

                        <button
                            type="button"
                            class="cart-item-remove"
                            data-cart-remove="${index}"
                            aria-label="حذف">
                            ×
                        </button>

                    </div>
                `;

            })
            .join("");
}


/* =========================================================
   CART QUANTITY
========================================================= */

function changeCartQuantity(index, delta) {

    const item = state.cart[index];

    if (!item) return;

    const product = state.products.find(
        product => product.id === item.productId
    );

    const color = product?.colors?.find(
        color => color.id === item.colorId
    );

    const stock = Number(color?.stock || 0);

    const newQuantity =
        Number(item.quantity) + delta;

    if (newQuantity <= 0) {

        state.cart.splice(index, 1);

    } else if (newQuantity > stock) {

        showToast(`المتاح فقط ${stock} قطعة`);

        return;

    } else {

        item.quantity = newQuantity;

    }

    saveCart();
    renderCart();
}


/* =========================================================
   REMOVE CART ITEM
========================================================= */

function removeCartItem(index) {

    if (!state.cart[index]) return;

    state.cart.splice(index, 1);

    saveCart();
    renderCart();

    showToast("تم حذف المنتج من السلة");
}


/* =========================================================
   CART DRAWER
========================================================= */

function openCart() {

    cartDrawer.classList.add("open");
    cartDrawer.setAttribute("aria-hidden", "false");

    cartOverlay.hidden = false;

    lockBody();
}


function closeCart() {

    cartDrawer.classList.remove("open");
    cartDrawer.setAttribute("aria-hidden", "true");

    cartOverlay.hidden = true;

    unlockBodyIfPossible();
}


/* =========================================================
   CHECKOUT
========================================================= */

function openCheckout() {

    if (!state.cart.length) {
        showToast("السلة فارغة");
        return;
    }

    closeCart();

    checkoutMessage.textContent = "";

    checkoutModal.hidden = false;

    updateCheckoutSummary();

    lockBody();
}


function closeCheckout() {

    checkoutModal.hidden = true;

    unlockBodyIfPossible();
}


function updateCheckoutSummary() {

    checkoutItemsCount.textContent =
        getCartCount();

    checkoutTotal.textContent =
        money(getCartTotal());
}


/* =========================================================
   PLACE ORDER
========================================================= */

async function placeOrder(event) {

    event.preventDefault();

    if (!state.cart.length) {
        showToast("السلة فارغة");
        return;
    }

    const formData =
        new FormData(checkoutForm);

    const name =
        String(formData.get("name") || "").trim();

    const phone =
        String(formData.get("phone") || "").trim();

    const address =
        String(formData.get("address") || "").trim();

    const paymentMethod =
        String(formData.get("paymentMethod") || "cod");

    const notes =
        String(formData.get("notes") || "").trim();

    if (!name || !phone || !address) {
        checkoutMessage.textContent =
            "من فضلك أكمل البيانات المطلوبة.";

        checkoutMessage.style.color =
            "var(--danger)";

        return;
    }

    const payload = {

        customer: {
            name,
            phone
        },

        items: state.cart.map(item => ({
            productId: item.productId,
            colorId: item.colorId,
            name: item.name,
            color: item.color,
            size: item.size,
            quantity: Number(item.quantity),
            price: Number(item.price),
            image: item.image
        })),

        total: getCartTotal(),

        address,

        paymentMethod,

        notes

    };

    placeOrderButton.disabled = true;
    placeOrderButton.textContent =
        "جاري إرسال الطلب...";

    checkoutMessage.textContent = "";

    try {

        const result =
            await api("/api/orders", {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(payload)
            });

        state.cart = [];

        saveCart();

        renderCart();

        checkoutForm.reset();

        checkoutMessage.style.color =
            "var(--success)";

        checkoutMessage.textContent =
            `تم تأكيد طلبك بنجاح — رقم الطلب: ${result.order?.id || "VINI"}`;

        showToast("تم إنشاء الطلب بنجاح");

        await loadStore();

        setTimeout(() => {
            closeCheckout();
        }, 2500);

    } catch (error) {

        console.error("Order error:", error);

        checkoutMessage.style.color =
            "var(--danger)";

        checkoutMessage.textContent =
            error.message ||
            "حدث خطأ أثناء إرسال الطلب.";

    } finally {

        placeOrderButton.disabled = false;

        placeOrderButton.textContent =
            "تأكيد الطلب";
    }
}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

    const theme =
        localStorage.getItem("vini_theme");

    if (theme === "dark") {
        document.body.classList.add("dark");
    }
}


function toggleTheme() {

    document.body.classList.toggle("dark");

    const isDark =
        document.body.classList.contains("dark");

    localStorage.setItem(
        "vini_theme",
        isDark ? "dark" : "light"
    );
}


/* =========================================================
   MOBILE MENU
========================================================= */

function toggleMobileMenu() {

    const menu =
        document.getElementById("mobileMenu");

    menu.classList.toggle("open");
}


function closeMobileMenu() {

    const menu =
        document.getElementById("mobileMenu");

    menu.classList.remove("open");
}


/* =========================================================
   EVENT LISTENERS
========================================================= */

categoryFilters.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("[data-category]");

        if (!button) return;

        state.activeCategory =
            button.dataset.category;

        renderCategories();
        renderProducts();

    }
);


productsGrid.addEventListener(
    "click",
    event => {

        const target =
            event.target.closest("[data-view-product]");

        const image =
            event.target.closest("[data-product]");

        const productId =
            target?.dataset.viewProduct ||
            image?.dataset.product;

        if (!productId) return;

        openProduct(productId);

    }
);


searchInput.addEventListener(
    "input",
    event => {

        state.search =
            event.target.value;

        renderProducts();

    }
);


colorOptions.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("[data-color-id]");

        if (!button || !state.selectedProduct) {
            return;
        }

        const color =
            state.selectedProduct.colors.find(
                item => item.id === button.dataset.colorId
            );

        if (!color) return;

        state.selectedColor = color;

        state.selectedSize =
            color.sizes?.[0] || null;

        state.selectedQuantity = 1;

        updateProductModal();

    }
);


sizeOptions.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest("[data-size]");

        if (!button) return;

        state.selectedSize =
            button.dataset.size;

        selectedSizeName.textContent =
            state.selectedSize;

        renderSizeOptions();

    }
);


document
    .getElementById("increaseQuantity")
    .addEventListener(
        "click",
        () => {

            const stock =
                Number(state.selectedColor?.stock || 0);

            if (
                state.selectedQuantity >= stock
            ) {
                showToast(`المتاح فقط ${stock} قطعة`);
                return;
            }

            state.selectedQuantity++;

            productQuantity.textContent =
                state.selectedQuantity;

        }
    );


document
    .getElementById("decreaseQuantity")
    .addEventListener(
        "click",
        () => {

            if (state.selectedQuantity <= 1) {
                return;
            }

            state.selectedQuantity--;

            productQuantity.textContent =
                state.selectedQuantity;

        }
    );


document
    .getElementById("addToCartButton")
    .addEventListener(
        "click",
        addToCart
    );


document
    .getElementById("closeProductModal")
    .addEventListener(
        "click",
        closeProductModal
    );


productModal.addEventListener(
    "click",
    event => {

        if (event.target === productModal) {
            closeProductModal();
        }

    }
);


document
    .getElementById("openCart")
    .addEventListener(
        "click",
        openCart
    );


document
    .getElementById("closeCart")
    .addEventListener(
        "click",
        closeCart
    );


cartOverlay.addEventListener(
    "click",
    closeCart
);


document
    .getElementById("continueShopping")
    .addEventListener(
        "click",
        closeCart
    );


cartItems.addEventListener(
    "click",
    event => {

        const plus =
            event.target.closest("[data-cart-plus]");

        const minus =
            event.target.closest("[data-cart-minus]");

        const remove =
            event.target.closest("[data-cart-remove]");

        if (plus) {

            changeCartQuantity(
                Number(plus.dataset.cartPlus),
                1
            );

            return;
        }

        if (minus) {

            changeCartQuantity(
                Number(minus.dataset.cartMinus),
                -1
            );

            return;
        }

        if (remove) {

            removeCartItem(
                Number(remove.dataset.cartRemove)
            );

        }

    }
);


document
    .getElementById("checkoutButton")
    .addEventListener(
        "click",
        openCheckout
    );


document
    .getElementById("closeCheckoutModal")
    .addEventListener(
        "click",
        closeCheckout
    );


checkoutModal.addEventListener(
    "click",
    event => {

        if (event.target === checkoutModal) {
            closeCheckout();
        }

    }
);


checkoutForm.addEventListener(
    "submit",
    placeOrder
);


document
    .getElementById("themeToggle")
    .addEventListener(
        "click",
        toggleTheme
    );


document
    .getElementById("mobileMenuButton")
    .addEventListener(
        "click",
        toggleMobileMenu
    );


document
    .getElementById("mobileCartButton")
    .addEventListener(
        "click",
        () => {

            closeMobileMenu();
            openCart();

        }
    );


document
    .querySelectorAll(".mobile-menu-inner a")
    .forEach(link => {

        link.addEventListener(
            "click",
            closeMobileMenu
        );

    });


document
    .querySelectorAll("[data-collection]")
    .forEach(card => {

        card.addEventListener(
            "click",
            () => {

                const category =
                    card.dataset.collection;

                state.activeCategory =
                    category;

                setTimeout(() => {

                    renderCategories();
                    renderProducts();

                }, 50);

            }
        );

    });


document.addEventListener(
    "keydown",
    event => {

        if (event.key !== "Escape") return;

        if (!productModal.hidden) {
            closeProductModal();
        }

        if (!checkoutModal.hidden) {
            closeCheckout();
        }

        if (cartDrawer.classList.contains("open")) {
            closeCart();
        }

    }
);


/* =========================================================
   INIT
========================================================= */

loadTheme();

loadStore();
