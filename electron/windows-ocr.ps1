param([string]$ImagePath,[switch]$Server)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Media.Ocr.OcrResult, Windows.Foundation, ContentType=WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime]
$taskAsTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
function Wait-WinRT($Operation, [Type]$ResultType) {
  $taskPending = $taskAsTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  if (-not $taskPending.Wait(20000)) { throw 'OCR timed out.' }
  return $taskPending.Result
}
$taskEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage((New-Object Windows.Globalization.Language('en-US')))
if ($null -eq $taskEngine) { throw 'Windows English OCR language is unavailable. Install English OCR under Windows language options.' }
function Read-OCRImage([string]$FilePath) {
$taskFile = Wait-WinRT ([Windows.Storage.StorageFile]::GetFileFromPathAsync($FilePath)) ([Windows.Storage.StorageFile])
$taskStream = Wait-WinRT ($taskFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
try {
  $taskDecoder = Wait-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($taskStream)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $taskBitmap = Wait-WinRT ($taskDecoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  try {
    $taskResult = Wait-WinRT ($taskEngine.RecognizeAsync($taskBitmap)) ([Windows.Media.Ocr.OcrResult])
    $taskLines = @($taskResult.Lines | ForEach-Object {
      $taskWords = @($_.Words | ForEach-Object { @{text=$_.Text;x=$_.BoundingRect.X;y=$_.BoundingRect.Y;width=$_.BoundingRect.Width;height=$_.BoundingRect.Height} })
      @{text=$_.Text;words=$taskWords}
    })
    return @{text=$taskResult.Text;lines=$taskLines;width=$taskBitmap.PixelWidth;height=$taskBitmap.PixelHeight}
  } finally { $taskBitmap.Dispose() }
} finally { $taskStream.Dispose() }
}
if ($Server) {
  while ($null -ne ($taskInput = [Console]::ReadLine())) {
    $taskRequest = $null
    try {
      $taskRequest = $taskInput | ConvertFrom-Json
      if ($null -eq $taskRequest.id -or [string]::IsNullOrWhiteSpace($taskRequest.file)) { throw 'Invalid OCR request.' }
      @{id=$taskRequest.id;result=(Read-OCRImage $taskRequest.file)} | ConvertTo-Json -Depth 8 -Compress
    } catch { @{id=$taskRequest.id;error=$_.Exception.Message} | ConvertTo-Json -Depth 3 -Compress }
  }
} else {
  if ([string]::IsNullOrWhiteSpace($ImagePath)) { throw 'ImagePath is required.' }
  Read-OCRImage $ImagePath | ConvertTo-Json -Depth 7 -Compress
}
