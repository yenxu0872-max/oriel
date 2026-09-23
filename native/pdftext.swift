// pdftext — print the text of a PDF, using on-device OCR for scanned pages.
//
//     pdftext <file.pdf>
//
// Pages with a real text layer are read directly with PDFKit. Pages without
// one (scans, photos of documents) are rendered and run through Apple's
// Vision text recognition, which runs entirely on this Mac.

import AppKit
import PDFKit
import Vision

guard CommandLine.arguments.count == 2 else {
    FileHandle.standardError.write("usage: pdftext <file.pdf>\n".data(using: .utf8)!)
    exit(64)
}
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let doc = PDFDocument(url: url) else {
    FileHandle.standardError.write("could not open PDF\n".data(using: .utf8)!)
    exit(65)
}
if doc.isLocked {
    FileHandle.standardError.write("PDF is password-protected\n".data(using: .utf8)!)
    exit(66)
}

func ocr(_ page: PDFPage) -> String {
    let box = page.bounds(for: .mediaBox)
    let scale: CGFloat = 2.0
    let size = NSSize(width: box.width * scale, height: box.height * scale)
    let image = page.thumbnail(of: size, for: .mediaBox)
    guard let cg = image.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return "" }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    try? VNImageRequestHandler(cgImage: cg, options: [:]).perform([request])
    return (request.results ?? []).compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

var out = ""
var ocrPages = 0
for i in 0..<doc.pageCount {
    guard let page = doc.page(at: i) else { continue }
    var text = page.string ?? ""
    if text.trimmingCharacters(in: .whitespacesAndNewlines).count < 20 {
        let scanned = ocr(page)
        if !scanned.isEmpty { text = scanned; ocrPages += 1 }
    }
    if !text.isEmpty { out += "[Page \(i + 1)]\n\(text)\n\n" }
}
if ocrPages > 0 {
    FileHandle.standardError.write("ocr:\(ocrPages)\n".data(using: .utf8)!)
}
print(out, terminator: "")
