const { ValidationError } = require("./validation-error")
const { NavigationView } = require("./navigation-view/navigation-view")
const { NavigationBar } = require("./navigation-view/navigation-bar")

class SheetViewUndefinedError extends Error {
    constructor() {
        super("Please call setView(view) first.")
        this.name = "SheetViewUndefinedError"
    }
}

class SheetViewTypeError extends ValidationError {
    constructor(parameter, type) {
        super(parameter, type)
        this.name = "SheetViewTypeError"
    }
}

class Sheet {
    #present = () => {}
    #dismiss = () => {}
    style = Sheet.UIModalPresentationStyle.PageSheet
    #preventDismiss = false
    #navBar

    static UIModalPresentationStyle = {
        Automatic: -2,
        FullScreen: 0,
        PageSheet: 1,
        FormSheet: 2,
        CurrentContext: 3,
        Custom: 4,
        OverFullScreen: 5,
        OverCurrentContext: 6,
        Popover: 7,
        BlurOverFullScreen: 8
    }

    /**
     * @type {NavigationView}
     */
    navigationView

    init() {
        this.initNavBar()
        const { width, height } = $device.info.screen
        const UIView = $objc("UIView").invoke("initWithFrame", $rect(0, 0, width, height))
        const ViewController = $objc("UIViewController").invoke("alloc.init")
        const ViewControllerView = ViewController.$view()
        //ViewControllerView.$setBackgroundColor($color("clear"))
        ViewControllerView.$addSubview(UIView)
        ViewController.$setModalPresentationStyle(this.style)
        ViewController.$setModalInPresentation(this.#preventDismiss)
        this.#present = () => {
            ViewControllerView.jsValue().add(this.navigationView?.getPage().definition ?? this.view)
            $ui.vc.ocValue().invoke("presentViewController:animated:completion:", ViewController, true, undefined)
        }
        this.#dismiss = () => ViewController.invoke("dismissViewControllerAnimated:completion:", true, undefined)
        return this
    }

    initNavBar() {
        if (!this.#navBar) {
            return
        }
        const { title = "", popButton = { title: $l10n("CLOSE") }, rightButtons = [] } = this.#navBar
        if (this.view === undefined) throw new SheetViewUndefinedError()

        this.navigationView = new NavigationView()
        const navBar = this.navigationView.navigationBar
        navBar.setLargeTitleDisplayMode(NavigationBar.largeTitleDisplayModeNever)
        navBar.navigationBarLargeTitleHeight -= navBar.navigationBarNormalHeight
        navBar.navigationBarNormalHeight = NavigationBar.pageSheetNavigationBarHeight
        navBar.navigationBarLargeTitleHeight += navBar.navigationBarNormalHeight
        if (
            this.style === Sheet.UIModalPresentationStyle.FullScreen ||
            this.style === Sheet.UIModalPresentationStyle.OverFullScreen ||
            this.style === Sheet.UIModalPresentationStyle.BlurOverFullScreen
        ) {
            navBar.setTopSafeArea()
        } else {
            navBar.removeTopSafeArea()
        }

        // 返回按钮
        popButton.events = Object.assign(
            {
                tapped: () => {
                    this.dismiss()
                    if (typeof popButton.tapped === "function") popButton.tapped()
                }
            },
            popButton.events ?? {}
        )
        this.navigationView.navigationBarItems.addLeftButton(popButton).setRightButtons(rightButtons)
        this.navigationView.setView(this.view).navigationBarTitle(title)
        if (this.view.props?.bgcolor) {
            this.navigationView?.getPage().setProp("bgcolor", this.view.props?.bgcolor)
        }
    }

    preventDismiss() {
        this.#preventDismiss = true
        return this
    }

    setStyle(style) {
        this.style = style
        return this
    }

    /**
     * 设置 view
     * @param {object} view 视图对象
     * @returns {this}
     */
    setView(view = {}) {
        if (typeof view !== "object") throw new SheetViewTypeError("view", "object")
        this.view = view
        return this
    }

    /**
     * 为 view 添加一个 navBar
     * @param {object} param
     *  {
     *      {string} title
     *      {object} popButton 参数与 BarButtonItem 一致
     *      {Array} rightButtons
     *  }
     * @returns {this}
     */
    addNavBar(navBarOptions) {
        this.#navBar = navBarOptions
        return this
    }

    /**
     * 弹出 Sheet
     */
    present() {
        this.#present()
    }

    /**
     * 关闭 Sheet
     */
    dismiss() {
        this.#dismiss()
    }

    static quickLookImage(data, title = $l10n("PREVIEW")) {
        const sheet = new Sheet()
        sheet
            .setView({
                type: "view",
                views: [
                    {
                        type: "scroll",
                        props: {
                            zoomEnabled: true,
                            maxZoomScale: 3
                        },
                        layout: $layout.fill,
                        views: [
                            {
                                type: "image",
                                props: { data: data },
                                layout: $layout.fill
                            }
                        ]
                    }
                ],
                layout: $layout.fill
            })
            .addNavBar({
                title,
                rightButtons: [
                    {
                        symbol: "square.and.arrow.up",
                        tapped: () => $share.sheet(data)
                    }
                ]
            })
            .init()
            .present()
    }
}

module.exports = {
    Sheet
}
