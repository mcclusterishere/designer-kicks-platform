import SwiftUI
import WebKit

/// The Heat Chart app shell: a full-bleed WKWebView over
/// theheatchart.com. The site is built app-first (standalone display,
/// safe-area-aware tab bar, viewport-fit=cover), so the shell stays
/// out of the way: same-site links stay in the app, external links
/// open Safari, and a branded offline screen handles dead network.

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

struct WebView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.047, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        webView.customUserAgent = (webView.value(forKey: "userAgent") as? String).map { "\($0) HeatChartApp/1.0" }

        model.webView = webView
        webView.load(URLRequest(url: homeURL))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        let model: WebViewModel
        init(model: WebViewModel) { self.model = model }

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
            if (error as NSError).code == NSURLErrorCancelled { return }
            model.offline = true
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
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
