class Sudhanva < Formula
  desc "CLI for the public sudhanva.me API"
  homepage "https://sudhanva.me/developers/cli/"
  url "https://sudhanva.me/cli/nsudhanva-sudhanva-0.1.0.tgz"
  version "0.1.0"
  sha256 "190c92dc71991112aa81d4a4c967d3f58d4dedb92a88ebdef652c7403f60b792"

  depends_on "node"

  def install
    bin.install "package/sudhanva.mjs" => "sudhanva"
  end

  test do
    assert_equal version.to_s, shell_output("#{bin}/sudhanva --version").strip
  end
end
