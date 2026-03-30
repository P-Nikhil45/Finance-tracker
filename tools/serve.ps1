param(
    [int]$Port = 5500,
    [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$ErrorActionPreference = "Stop"

function Get-ContentType([string]$Path) {
    switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
        ".html" { "text/html; charset=utf-8" }
        ".css"  { "text/css; charset=utf-8" }
        ".js"   { "application/javascript; charset=utf-8" }
        ".json" { "application/json; charset=utf-8" }
        ".png"  { "image/png" }
        ".jpg"  { "image/jpeg" }
        ".jpeg" { "image/jpeg" }
        ".svg"  { "image/svg+xml" }
        default { "application/octet-stream" }
    }
}

function Send-Response($Client, [int]$StatusCode, [string]$StatusText, [byte[]]$Body, [string]$ContentType) {
    $stream = $Client.GetStream()
    
    # Build response headers as bytes
    $statusLine = "HTTP/1.1 $StatusCode $StatusText`r`n"
    $headers = "Content-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
    
    $statusBytes = [System.Text.Encoding]::ASCII.GetBytes($statusLine)
    $headersBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
    
    # Write everything to the stream
    $stream.Write($statusBytes, 0, $statusBytes.Length)
    $stream.Write($headersBytes, 0, $headersBytes.Length)
    $stream.Write($Body, 0, $Body.Length)
    $stream.Flush()
    
    # Properly close the connection
    $stream.Close()
    $Client.Close()
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
$listener.Start()

Write-Host "Bravo Finance Tracker server running at http://127.0.0.1:$Port/"
Write-Host "Serving files from $Root"
Write-Host "Press Ctrl+C to stop."

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] New connection from $($client.Client.RemoteEndPoint)" -ForegroundColor Green

        try {
            $stream = $client.GetStream()
            $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Request: $requestLine" -ForegroundColor Cyan

            while ($reader.Peek() -ge 0) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrWhiteSpace($line)) {
                    break
                }
            }

            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Empty request" -ForegroundColor Red
                $body = [System.Text.Encoding]::UTF8.GetBytes("Bad Request")
                Send-Response $client 400 "Bad Request" $body "text/plain; charset=utf-8"
                continue
            }

            $parts = $requestLine.Split(" ")
            $method = $parts[0]
            $rawPath = if ($parts.Length -gt 1) { $parts[1] } else { "/" }

            if ($method -ne "GET") {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Method not allowed: $method" -ForegroundColor Yellow
                $body = [System.Text.Encoding]::UTF8.GetBytes("Method Not Allowed")
                Send-Response $client 405 "Method Not Allowed" $body "text/plain; charset=utf-8"
                continue
            }

            $cleanPath = $rawPath.Split("?")[0].TrimStart("/")
            if ([string]::IsNullOrWhiteSpace($cleanPath)) {
                $cleanPath = "index.html"
            }

            $relativePath = $cleanPath.Replace("/", "\")
            $fullPath = Join-Path $Root $relativePath

            if ((Test-Path $fullPath) -and -not (Get-Item $fullPath).PSIsContainer) {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Serving: $relativePath" -ForegroundColor Green
                $body = [System.IO.File]::ReadAllBytes($fullPath)
                Send-Response $client 200 "OK" $body (Get-ContentType $fullPath)
            }
            else {
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Not found: $relativePath" -ForegroundColor Yellow
                $body = [System.Text.Encoding]::UTF8.GetBytes("404 - File not found")
                Send-Response $client 404 "Not Found" $body "text/plain; charset=utf-8"
            }
        }
        catch {
            Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error: $_" -ForegroundColor Red
            try {
                $body = [System.Text.Encoding]::UTF8.GetBytes("500 - Internal Server Error")
                Send-Response $client 500 "Internal Server Error" $body "text/plain; charset=utf-8"
            }
            catch {
                $client.Close()
            }
        }
    }
}
finally {
    $listener.Stop()
}
