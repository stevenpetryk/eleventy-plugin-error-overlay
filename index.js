const nunjucks = require("nunjucks")
const fs = require("fs")
const path = require("path")
const ErrorStackParser = require("error-stack-parser")

let errorToShow = null

module.exports = {
  configFunction: (eleventyConfig) => {
    eleventyConfig.setBrowserSyncConfig({
      ...eleventyConfig.browserSyncConfig,
      middleware: [showErrorMiddleware],
    })

    setImmediate(() => {
      const Eleventy = require("@11ty/eleventy/src/Eleventy.js")
      const EleventyErrorHandler = require("@11ty/eleventy/src/EleventyErrorHandler.js")

      if (!Eleventy.prototype) {
        return
      }

      let context = null

      function _watch(originalWatch) {
        context = this
        errorToShow = null

        return originalWatch.apply(this)
      }

      function error(originalError, buildError) {
        if (!context) {
          return
        }

        errorToShow = buildError
        context.eleventyServe.reload()
        return originalError.apply(this)
      }

      override(Eleventy, _watch)
      overrideStatic(EleventyErrorHandler, error)
    })
  },
}

async function showErrorMiddleware(req, res, next) {
  if (!errorToShow) {
    next()
    return
  }

  const stackTrace = ErrorStackParser.parse(errorToShow).map((item) => ({
    ...item,
    fileName: item.fileName.replace(process.cwd(), ".").replace(process.env.HOME, "~"),
  }))

  const template = fs.readFileSync(path.join(__dirname, "error-page.njk")).toString()

  const renderedPage = nunjucks.renderString(template, {
    errorName: errorToShow.name,
    errorMessage: errorToShow.message,
    stackTrace,
  })

  res.status = 500
  res.setHeader("content-type", "text/html")
  res.end(renderedPage)
}

function override(obj, fn) {
  const originalFn = obj.prototype[fn.name].__original || obj.prototype[fn.name]
  function wrapper() {
    return fn.bind(this, originalFn).apply(this, arguments)
  }
  wrapper.__original = originalFn
  obj.prototype[fn.name] = wrapper
}

function overrideStatic(obj, fxn) {
  const original_fxn = obj[fxn.name].__original || obj[fxn.name]
  function wrapper() {
    return fxn.bind(this, original_fxn).apply(this, arguments)
  }
  wrapper.__original = original_fxn
  obj[fxn.name] = wrapper
}
