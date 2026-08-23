class Sudhanva < Formula
  desc "CLI for the public sudhanva.me API"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/initiable-sudhanva-0.1.3.tgz"
  sha256 "32478629d84a7f518215f672800fbad48affce267617c140a90f06e5411110fc"

  livecheck do
    url :homepage
    regex(/initiable-sudhanva[._-]v?(\d+(?:\.\d+)+)\.t/i)
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
