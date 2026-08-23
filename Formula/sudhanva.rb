class Sudhanva < Formula
  desc "CLI for the public sudhanva.me API"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/nsudhanva-sudhanva-0.1.1.tgz"
  sha256 "fbd21bc67e8922fcc3e1ace6bfb11ff0add2b28616614bd52fc027e314c132a2"

  livecheck do
    url :homepage
    regex(/nsudhanva-sudhanva[._-]v?(\d+(?:\.\d+)+)\.t/i)
  end

  depends_on "node"

  def install
    bin.install "sudhanva.mjs" => "sudhanva"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/sudhanva --version").strip
    assert_match "read-only HTTPS GET requests", shell_output("#{bin}/sudhanva --help")
  end
end
