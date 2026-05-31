$certDir = Join-Path $PSScriptRoot "cert"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$existing = Get-ChildItem -Path $certDir -Filter "server.pfx" -ErrorAction SilentlyContinue
if ($existing) {
  Write-Host "Certificato gia presente: $($existing.FullName)"
  exit 0
}

$cert = New-SelfSignedCertificate `
  -Subject "CN=Check-In Local" `
  -DnsName @("localhost", "192.168.1.3") `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -NotAfter (Get-Date).AddYears(1) `
  -CertStoreLocation "Cert:\CurrentUser\My"

$pwd = ConvertTo-SecureString -String "checkin" -Force -AsPlainText
$pfxPath = Join-Path $certDir "server.pfx"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $pwd | Out-Null

Write-Host "Certificato creato: $pfxPath"
