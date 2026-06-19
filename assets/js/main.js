const toggle = document.querySelector(".nav-toggle");
const menu = document.querySelector("#site-menu");

if (toggle && menu) {
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    menu.classList.toggle("is-open");
  });
}
