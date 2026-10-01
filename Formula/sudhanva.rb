class Sudhanva < Formula
  desc "CLI for public sudhanva.me data and profile insights"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/sudhanva-0.2.0.tgz"
  sha256 "f14a1db22145edf971b61e9b776487a3019e38935a759cae26846c68ca0243de"
  license "MIT"

  livecheck do
    url :homepage
    regex(/sudhanva[._-]v?(\d+(?:\.\d+)+)\.t/i)
  end

  depends_on "node"

  def install
    libexec.install Dir["*"]
    bin.install_symlink libexec/"sudhanva.mjs" => "sudhanva"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/sudhanva --version").strip
    assert_match "Insight jobs expire after 24 hours", shell_output("#{bin}/sudhanva --help")
  end
end
