class Sudhanva < Formula
  desc "CLI for the public sudhanva.me API"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/nsudhanva-sudhanva-0.1.2.tgz"
  sha256 "e718a4e87c27f48301d55729b354dca6933ee107c67d03edc8f72dd8745d9a35"

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
