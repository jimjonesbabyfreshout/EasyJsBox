const { VERSION } = require("./version")

String.prototype.trim = function (char, type) {
    if (char) {
        if (type === "l") {
            return this.replace(new RegExp("^\\" + char + "+", "g"), "")
        } else if (type === "r") {
            return this.replace(new RegExp("\\" + char + "+$", "g"), "")
        }
        return this.replace(new RegExp("^\\" + char + "+|\\" + char + "+$", "g"), "")
    }
    return this.replace(/^\s+|\s+$/g, "")
}

class Kernel {
    startTime = Date.now()
    // 隐藏 jsbox 默认 nav 栏
    isUseJsboxNav = false

    constructor() {
        if ($app.isDebugging) {
            this.debug()
        }
    }

    /**
     * @type {boolean}
     */
    static isTaio = $app.info.bundleID.includes("taio")

    static l10n(language, content, override = true) {
        if (typeof content === "string") {
            const strings = {}
            const strArr = content.split(";")
            strArr.forEach(line => {
                line = line.trim()
                if (line !== "") {
                    const kv = line.split("=")
                    strings[kv[0].trim().slice(1, -1)] = kv[1].trim().slice(1, -1)
                }
            })
            content = strings
        }
        const strings = $app.strings
        if (override) {
            strings[language] = Object.assign($app.strings[language], content)
        } else {
            strings[language] = Object.assign(content, $app.strings[language])
        }
        $app.strings = strings
    }

    /**
     * 压缩图片
     * @param {$image} image $image
     * @param {number} maxSize 图片最大尺寸 单位：像素
     * @returns {$image}
     */
    static compressImage(image, maxSize = 1280 * 720) {
        const info = $imagekit.info(image)
        if (info.height * info.width > maxSize) {
            const scale = maxSize / (info.height * info.width)
            image = $imagekit.scaleBy(image, scale)
        }
        return image
    }

    static objectEqual(a, b) {
        let aProps = Object.getOwnPropertyNames(a)
        let bProps = Object.getOwnPropertyNames(b)
        if (aProps.length !== bProps.length) {
            return false
        }
        for (let i = 0; i < aProps.length; i++) {
            let propName = aProps[i]

            let propA = a[propName]
            let propB = b[propName]
            if (Array.isArray(propA)) {
                for (let i = 0; i < propA.length; i++) {
                    if (!Kernel.objectEqual(propA[i], propB[i])) {
                        return false
                    }
                }
            } else if (typeof propA === "object") {
                return Kernel.objectEqual(propA, propB)
            } else if (propA !== propB) {
                return false
            }
        }
        return true
    }

    /**
     * 对比版本号
     * @param {string} preVersion
     * @param {string} lastVersion
     * @returns {number} 1: preVersion 大, 0: 相等, -1: lastVersion 大
     */
    static versionCompare(preVersion = "", lastVersion = "") {
        let sources = preVersion.split(".")
        let dests = lastVersion.split(".")
        let maxL = Math.max(sources.length, dests.length)
        let result = 0
        for (let i = 0; i < maxL; ++i) {
            let preValue = sources.length > i ? sources[i] : 0
            let preNum = isNaN(Number(preValue)) ? preValue.charCodeAt() : Number(preValue)
            let lastValue = dests.length > i ? dests[i] : 0
            let lastNum = isNaN(Number(lastValue)) ? lastValue.charCodeAt() : Number(lastValue)
            if (preNum < lastNum) {
                result = -1
                break
            } else if (preNum > lastNum) {
                result = 1
                break
            }
        }
        return result
    }

    static deleteConfirm(message, conformAction) {
        $ui.alert({
            title: message,
            actions: [
                {
                    title: $l10n("DELETE"),
                    style: $alertActionType.destructive,
                    handler: () => {
                        conformAction()
                    }
                },
                { title: $l10n("CANCEL") }
            ]
        })
    }

    static bytesToSize(bytes) {
        if (bytes === 0) return "0 B"
        const k = 1024,
            sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
            i = Math.floor(Math.log(bytes) / Math.log(k))

        return (bytes / Math.pow(k, i)).toPrecision(3) + " " + sizes[i]
    }

    debug(print, error) {
        this.debugMode = true
        $app.idleTimerDisabled = true
        if (typeof print === "function") {
            this.debugPrint = print
        }
        if (typeof error === "function") {
            this.debugError = error
        }
        this.print("You are running EasyJsBox in debug mode.")
    }

    print(message) {
        if (!this.debugMode) return
        if (typeof this.debugPrint === "function") {
            this.debugPrint(message)
        } else {
            console.log(message)
        }
    }

    error(error) {
        if (!this.debugMode) return
        if (typeof this.debugError === "function") {
            this.debugError(error)
        } else {
            console.error(error)
        }
    }

    useJsboxNav() {
        this.isUseJsboxNav = true
        return this
    }

    setTitle(title) {
        if (this.isUseJsboxNav) {
            $ui.title = title
        }
        this.title = title
    }

    setNavButtons(buttons) {
        this.navButtons = buttons
    }

    UIRender(view) {
        try {
            view.props = Object.assign(
                {
                    title: this.title,
                    navBarHidden: !this.isUseJsboxNav,
                    navButtons: this.navButtons ?? [],
                    statusBarStyle: 0
                },
                view.props
            )
            if (!view.events) {
                view.events = {}
            }
            const oldLayoutSubviews = view.events.layoutSubviews
            const { UIKit } = require("./ui-kit")
            view.events.layoutSubviews = () => {
                $app.notify({
                    name: "interfaceOrientationEvent",
                    object: {
                        statusBarOrientation: UIKit.statusBarOrientation,
                        isHorizontal: UIKit.isHorizontal
                    }
                })
                if (typeof oldLayoutSubviews === "function") oldLayoutSubviews()
            }
            $ui.render(view)
        } catch (error) {
            this.print(error)
        }
    }

    async checkUpdate() {
        const branche = "dev" // 更新版本，可选 master, dev
        const configRes = await $http.get(
            `https://raw.githubusercontent.com/ipuppet/EasyJsBox/${branche}/src/version.js`
        )
        if (configRes.error) {
            throw configRes.error
        }

        const latestVersion = srcRes.data.match(/.*VERSION.?\"([0-9\.]+)\"/)[1]

        this.print(`easy-jsbox latest version: ${latestVersion}`)
        if (Kernel.versionCompare(latestVersion, VERSION) > 0) {
            const srcRes = await $http.get(
                `https://raw.githubusercontent.com/ipuppet/EasyJsBox/${branche}/dist/easy-jsbox.js`
            )
            if (srcRes.error) {
                throw srcRes.error
            }

            return srcRes.data
        }

        return false
    }
}

module.exports = {
    Kernel
}
