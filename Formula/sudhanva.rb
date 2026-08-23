class Sudhanva < Formula
  desc "CLI for public sudhanva.me data and profile insights"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/sudhanva-0.1.5.tgz"
  sha256 "ceb14e6ef3a9c641e06f276bd34730891487addf2f474df74c82db85181903d4"

  livecheck do
    url :homepage
    regex(/sudhanva[._-]v?(\d+(?:\.\d+)+)\.t/i)
  end

  depends_on "node"

  def install
    bin.install "sudhanva.mjs" => "sudhanva"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/sudhanva --version").strip
    assert_match "Insight jobs expire after 24 hours", shell_output("#{bin}/sudhanva --help")
  end
end
