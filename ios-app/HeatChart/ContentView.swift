import SwiftUI
import WebKit
import UserNotifications

/// The Heat Chart app shell. Not a bare webview — the native layer
/// carries its own weight (App Review 4.2):
///  - native share sheet (navigator.share bridge)
///  - haptic feedback on votes, fired by the site through a JS bridge
///  - native pull-to-refresh
///  - camera / photo library integration for submissions
///  - a local daily reminder (no server push needed)
///  - branded offline screen, external links out to Safari
/// Same-site links stay in the app; the site is app-first already
/// (standalone display, safe-area tab bar, viewport-fit=cover).

private let homeURL = URL(string: "https://theheatchart.com/")!
private let appHosts: Set<String> = ["theheatchart.com", "www.theheatchart.com"]

struct ContentView: View {
    @StateObject private var model = WebViewModel()

    var body: some View {
        ZStack {
            Color(red: 0.043, green: 0.043, blue: 0.047).ignoresSafeArea()
            WebView(model: model)
                .ignoresSafeArea(edges: .bottom)
            if model.offline {
                OfflineView { model.reload() }
            }
        }
        .onAppear { ReminderScheduler.registerLaunch() }
    }
}

final class WebViewModel: ObservableObject {
    @Published var offline = false
    weak var webView: WKWebView?

    func reload() {
        offline = false
        if webView?.url == nil {
            webView?.load(URLRequest(url: homeURL))
        } else {
            webView?.reload()
        }
    }
}

/// Daily local reminder — native re-engagement without a push server.
/// Asks for permission on the third launch (not the first — let the
/// app earn it), schedules one quiet daily nudge, never duplicates.
enum ReminderScheduler {
    private static let launchKey = "hc.launchCount"
    private static let askedKey = "hc.askedNotifications"
    private static let reminderId = "hc.dailyBattles"

    static func registerLaunch() {
        let defaults = UserDefaults.standard
        let launches = defaults.integer(forKey: launchKey) + 1
        defaults.set(launches, forKey: launchKey)
        guard launches >= 3, !defaults.bool(forKey: askedKey) else { return }
        defaults.set(true, forKey: askedKey)

        let center = UNUserNotificationCenter.current()
        center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "The floor is live"
            content.body = "Fresh battles are up and your free strikes reset — come judge the heat."
            content.sound = .default

            var time = DateComponents()
            time.hour = 19
            let trigger = UNCalendarNotificationTrigger(dateMatching: time, repeats: true)
            let request = UNNotificationRequest(identifier: reminderId, content: content, trigger: trigger)
            center.removePendingNotificationRequests(withIdentifiers: [reminderId])
            center.add(request)
        }
    }
}

struct WebView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        // Supported API for UA customization — the site uses this token
        // to hide third-party login and external purchases in-app.
        config.applicationNameForUserAgent = "HeatChartApp/1.0"

        // Native share sheet: WKWebView has no navigator.share, so the
        // site's Share buttons would dead-end. Polyfill it to post into
        // the shell, which presents the real iOS share sheet.
        let sharePolyfill = WKUserScript(
            source: """
            if (!navigator.share) {
              navigator.share = function (data) {
                window.webkit.messageHandlers.share.postMessage({
                  title: (data && data.title) || "",
                  text: (data && data.text) || "",
                  url: (data && data.url) || location.href
                });
                return Promise.resolve();
              };
            }
            """,
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(sharePolyfill)
        config.userContentController.add(context.coordinator, name: "share")
        config.userContentController.add(context.coordinator, name: "haptic")

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.047, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor

        // Native pull-to-refresh.
        let refresh = UIRefreshControl()
        refresh.tintColor = UIColor(red: 0.941, green: 0.306, blue: 0.271, alpha: 1)
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.handleRefresh), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        model.webView = webView
        context.coordinator.webView = webView
        webView.load(URLRequest(url: homeURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        let model: WebViewModel
        weak var webView: WKWebView?
        init(model: WebViewModel) { self.model = model }

        @objc func handleRefresh() {
            webView?.reload()
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            switch message.name {
            case "haptic":
                let kind = message.body as? String ?? "light"
                switch kind {
                case "success":
                    UINotificationFeedbackGenerator().notificationOccurred(.success)
                case "warning":
                    UINotificationFeedbackGenerator().notificationOccurred(.warning)
                default:
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                }
            case "share":
                guard let body = message.body as? [String: Any] else { return }
                var items: [Any] = []
                if let text = body["text"] as? String, !text.isEmpty { items.append(text) }
                if let urlString = body["url"] as? String, let url = URL(string: urlString) {
                    items.append(url)
                }
                guard !items.isEmpty else { return }
                let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
                let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene
                let root = scene?.keyWindow?.rootViewController
                sheet.popoverPresentationController?.sourceView = root?.view
                root?.present(sheet, animated: true)
            default:
                break
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }
            // Mail/tel and off-site links leave the shell.
            if let scheme = url.scheme, !["https", "http", "about"].contains(scheme) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            if navigationAction.navigationType == .linkActivated,
               let host = url.host?.lowercased(),
               !appHosts.contains(host) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        // target=_blank links (share sheets, affiliate outlinks) → Safari.
        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if let url = navigationAction.request.url {
                if let host = url.host?.lowercased(), appHosts.contains(host) {
                    webView.load(navigationAction.request)
                } else {
                    UIApplication.shared.open(url)
                }
            }
            return nil
        }

        func webView(
            _ webView: WKWebView,
            didFailProvisionalNavigation navigation: WKNavigation!,
            withError error: Error
        ) {
            webView.scrollView.refreshControl?.endRefreshing()
            if (error as NSError).code == NSURLErrorCancelled { return }
            model.offline = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.offline = false
        }
    }
}

struct OfflineView: View {
    let retry: () -> Void

    var body: some View {
        ZStack {
            Color(red: 0.043, green: 0.043, blue: 0.047).ignoresSafeArea()
            VStack(spacing: 14) {
                Text("THE HEAT CHART")
                    .font(.system(size: 22, weight: .heavy))
                    .foregroundColor(.white)
                Text("No connection. The arena needs a signal.")
                    .font(.system(size: 15))
                    .foregroundColor(Color(white: 0.7))
                    .multilineTextAlignment(.center)
                Button(action: retry) {
                    Text("TRY AGAIN")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.941, green: 0.306, blue: 0.271))
                        .cornerRadius(10)
                }
                .padding(.top, 6)
            }
            .padding(32)
        }
    }
}
