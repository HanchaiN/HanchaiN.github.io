import type { GatsbyConfig } from "gatsby";

const config: GatsbyConfig = {
  siteMetadata: {
    title: `HanchaiN`,
    description: `HanchaiN's GitHub Page`,
    siteUrl: `https://HanchaiN.github.io`,
  },
  graphqlTypegen: {
    generateOnBuild: true,
  },
  plugins: [
    "gatsby-plugin-sass",
    "gatsby-plugin-image",
    "gatsby-plugin-sitemap",
    {
      resolve: "gatsby-plugin-manifest",
      options: {
        lang: "en-US",
        dir: "ltr",
        name: "HanchaiN's GitHub Page",
        short_name: "HanchaiN",
        description: "HanchaiN's GitHub Page",
        icon: "src/images/icon.png",
        scope: "/",
        start_url: "/",
        display: "browser",
        orientation: "landscape-primary",
        // theme_color: "#b36619",
        // background_color: "#fbfaf9",
      },
    },
    "gatsby-plugin-mdx",
    "gatsby-plugin-sharp",
    "gatsby-transformer-sharp",
    {
      resolve: "gatsby-source-filesystem",
      options: {
        name: "posts",
        path: `${__dirname}/src/posts/`,
      },
    },
    {
      resolve: "gatsby-plugin-webpack-bundle-analyser-v2",
      options: {
        analyzerMode: "static",
        openAnalyzer: false,
      },
    },
  ],
};

export default config;
