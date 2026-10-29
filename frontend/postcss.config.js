import postcssCustomMedia from "postcss-custom-media";

// Breakpoints are defined once as custom media in src/styles/media.css (UI-001) and imported by
// every stylesheet that needs them; this plugin compiles them to plain media queries.
export default {
  plugins: [postcssCustomMedia()],
};
