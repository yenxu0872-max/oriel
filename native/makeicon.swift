// Draws the oriel.ai app icon — the design's orb on a dark macOS-style
// rounded square — as a 1024 px PNG. `oriel app` turns it into AppIcon.icns.
//
//   swift makeicon.swift out.png
//
// Colours are the logo's own: the #17171a disc, the violet→sky gradient
// (oklch(0.68 0.19 300) → oklch(0.7 0.15 230) in the page), the white dot.

import AppKit

let size = 1024
let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "AppIcon.png"
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
                    space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
func rgb(_ hex: UInt32, _ a: CGFloat = 1) -> CGColor {
    CGColor(srgbRed: CGFloat(hex >> 16 & 255) / 255, green: CGFloat(hex >> 8 & 255) / 255, blue: CGFloat(hex & 255) / 255, alpha: a)
}

// Apple's icon grid: an 824 px body centred on the 1024 canvas, with room for the shadow.
let body = CGRect(x: 100, y: 100, width: 824, height: 824)
let shape = CGPath(roundedRect: body, cornerWidth: 186, cornerHeight: 186, transform: nil)

ctx.saveGState()
ctx.setShadow(offset: CGSize(width: 0, height: -12), blur: 28, color: rgb(0x000000, 0.35))
ctx.addPath(shape); ctx.setFillColor(rgb(0x17171a)); ctx.fillPath()
ctx.restoreGState()

// The body: near-black, a touch lighter at the top.
ctx.saveGState()
ctx.addPath(shape); ctx.clip()
ctx.drawLinearGradient(CGGradient(colorsSpace: space, colors: [rgb(0x26262e), rgb(0x121216)] as CFArray, locations: [0, 1])!,
                       start: CGPoint(x: 512, y: 924), end: CGPoint(x: 512, y: 100), options: [])

// A soft violet glow behind the orb, like the page's welcome screen.
let centre = CGPoint(x: 512, y: 500)
ctx.drawRadialGradient(CGGradient(colorsSpace: space, colors: [rgb(0xac77fa, 0.42), rgb(0xac77fa, 0)] as CFArray, locations: [0, 1])!,
                       startCenter: centre, startRadius: 0, endCenter: centre, endRadius: 420, options: [])

// The orb: violet at the top left to sky blue at the bottom right (150° in CSS).
let orbR: CGFloat = 250
ctx.saveGState()
ctx.addEllipse(in: CGRect(x: centre.x - orbR, y: centre.y - orbR, width: orbR * 2, height: orbR * 2)); ctx.clip()
ctx.drawLinearGradient(CGGradient(colorsSpace: space, colors: [rgb(0xac77fa), rgb(0x00aee9)] as CFArray, locations: [0, 1])!,
                       start: CGPoint(x: centre.x - orbR * 0.5, y: centre.y + orbR * 0.87),
                       end: CGPoint(x: centre.x + orbR * 0.5, y: centre.y - orbR * 0.87), options: [])
// a gentle highlight, so it reads as a sphere rather than a flat disc
ctx.drawRadialGradient(CGGradient(colorsSpace: space, colors: [rgb(0xffffff, 0.30), rgb(0xffffff, 0)] as CFArray, locations: [0, 1])!,
                       startCenter: CGPoint(x: centre.x - 90, y: centre.y + 100), startRadius: 0,
                       endCenter: CGPoint(x: centre.x - 90, y: centre.y + 100), endRadius: 260, options: [])
ctx.restoreGState()

// The white dot at the top right, ringed in the body colour.
let dot = CGPoint(x: centre.x + 205, y: centre.y + 205), dotR: CGFloat = 92, ring: CGFloat = 26
ctx.setFillColor(rgb(0x1b1b21)); ctx.fillEllipse(in: CGRect(x: dot.x - dotR - ring, y: dot.y - dotR - ring, width: (dotR + ring) * 2, height: (dotR + ring) * 2))
ctx.setFillColor(rgb(0xffffff)); ctx.fillEllipse(in: CGRect(x: dot.x - dotR, y: dot.y - dotR, width: dotR * 2, height: dotR * 2))

// A hairline edge, as on Apple's own dark icons.
ctx.addPath(shape); ctx.setStrokeColor(rgb(0xffffff, 0.08)); ctx.setLineWidth(3); ctx.strokePath()
ctx.restoreGState()

let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: out))
