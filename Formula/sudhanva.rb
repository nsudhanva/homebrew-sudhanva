class Sudhanva < Formula
  desc "CLI for the public sudhanva.me API"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/sudhanva-0.1.4.tgz"
  sha256 "45fdca9a4398e52b8dd69c35469b5d87d7e7ec1af4584d4600dad3e886439272"

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
    assert_match "read-only HTTPS GET requests", shell_output("#{bin}/sudhanva --help")
  end
end
