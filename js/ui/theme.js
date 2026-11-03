(function () {
  const storageKey = "lidmed-theme";
  const validThemes = ["auto", "light", "dark"];
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  function getPreference() {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return validThemes.includes(saved) ? saved : "auto";
    } catch (error) {
      console.warn("Não foi possível ler a preferência de tema local.", error);
      return "auto";
    }
  }

  function apply(preference) {
    const theme = validThemes.includes(preference) ? preference : "auto";
    const resolvedTheme = theme === "auto"
      ? (mediaQuery.matches ? "dark" : "light")
      : theme;

    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.content = resolvedTheme === "dark" ? "#101820" : "#0F4C5C";
  }

  function setPreference(preference) {
    if (!validThemes.includes(preference)) {
      throw new Error("Preferência de tema inválida.");
    }

    try {
      window.localStorage.setItem(storageKey, preference);
    } catch (error) {
      console.warn("Não foi possível salvar a preferência de tema local.", error);
    }
    apply(preference);
  }

  window.lidmedTheme = { apply, getPreference, setPreference };
  apply(getPreference());

  mediaQuery.addEventListener("change", function () {
    if (getPreference() === "auto") apply("auto");
  });
})();
