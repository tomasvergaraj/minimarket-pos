[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "Medium")]
param(
    [switch]$IncludeLogs,
    [switch]$IncludeNodeModules,
    [switch]$IncludeVenv
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Get-RepoRoot {
    return (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
}

function Test-ExcludedPath {
    param(
        [string]$PathValue,
        [string[]]$ExcludedFragments
    )

    $normalized = $PathValue.ToLowerInvariant()
    foreach ($fragment in $ExcludedFragments) {
        if ($normalized.Contains($fragment.ToLowerInvariant())) {
            return $true
        }
    }

    return $false
}

function Remove-IfPresent {
    param(
        [string]$PathValue,
        [string]$Label
    )

    if (-not (Test-Path $PathValue)) {
        return $false
    }

    if ($PSCmdlet.ShouldProcess($PathValue, "Remove $Label")) {
        Remove-Item -Path $PathValue -Recurse -Force
        return $true
    }

    return $false
}

function Remove-MatchingFiles {
    param(
        [string]$RootPath,
        [string[]]$Patterns,
        [string[]]$ExcludedFragments = @()
    )

    if (-not (Test-Path $RootPath)) {
        return 0
    }

    $count = 0
    $items = Get-ChildItem -Path $RootPath -Recurse -Force -File -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -in $Patterns -or $_.Extension -in $Patterns
        } |
        Where-Object {
            -not (Test-ExcludedPath -PathValue $_.FullName -ExcludedFragments $ExcludedFragments)
        }

    foreach ($item in $items) {
        if ($PSCmdlet.ShouldProcess($item.FullName, "Remove file")) {
            Remove-Item -Path $item.FullName -Force
            $count++
        }
    }

    return $count
}

function Remove-MatchingDirectories {
    param(
        [string]$RootPath,
        [string[]]$Names,
        [string[]]$ExcludedFragments = @()
    )

    if (-not (Test-Path $RootPath)) {
        return 0
    }

    $count = 0
    $items = Get-ChildItem -Path $RootPath -Recurse -Force -Directory -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -in $Names
        } |
        Where-Object {
            -not (Test-ExcludedPath -PathValue $_.FullName -ExcludedFragments $ExcludedFragments)
        }

    foreach ($item in $items) {
        if ($PSCmdlet.ShouldProcess($item.FullName, "Remove directory")) {
            Remove-Item -Path $item.FullName -Recurse -Force
            $count++
        }
    }

    return $count
}

$repoRoot = Get-RepoRoot
$removedPaths = New-Object System.Collections.Generic.List[string]
$excludedFragments = @("\.git\", "\node_modules\", "\venv\", "\deploy\output\")

Write-Step "Removing generated build output"
$pathsToRemove = @(
    (Join-Path $repoRoot "admin-web\dist"),
    (Join-Path $repoRoot "admin-web\node_modules\.vite"),
    (Join-Path $repoRoot "client-electron-pos\dist"),
    (Join-Path $repoRoot "client-electron-pos\dist-electron"),
    (Join-Path $repoRoot "client-electron-pos\node_modules\.vite"),
    (Join-Path $repoRoot "deploy\output")
)

foreach ($pathValue in $pathsToRemove) {
    if (Remove-IfPresent -PathValue $pathValue -Label "generated output") {
        $removedPaths.Add($pathValue)
    }
}

Write-Step "Removing transient caches"
$removedPyCaches = Remove-MatchingDirectories -RootPath $repoRoot -Names @("__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache") -ExcludedFragments $excludedFragments
$removedPyFiles = Remove-MatchingFiles -RootPath $repoRoot -Patterns @(".pyc", ".pyo") -ExcludedFragments $excludedFragments
$removedTsBuildInfo = Remove-MatchingFiles -RootPath $repoRoot -Patterns @(".tsbuildinfo") -ExcludedFragments $excludedFragments

if ($IncludeLogs.IsPresent) {
    Write-Step "Removing backend log files"
    $logDir = Join-Path $repoRoot "server-fastapi\logs"
    if (Test-Path $logDir) {
        $logFiles = Get-ChildItem -Path $logDir -Force -File
        foreach ($logFile in $logFiles) {
            if ($PSCmdlet.ShouldProcess($logFile.FullName, "Remove log file")) {
                Remove-Item -Path $logFile.FullName -Force
                $removedPaths.Add($logFile.FullName)
            }
        }
    }
}

if ($IncludeNodeModules.IsPresent) {
    Write-Step "Removing node_modules"
    foreach ($nodeModulesPath in @(
        (Join-Path $repoRoot "admin-web\node_modules"),
        (Join-Path $repoRoot "client-electron-pos\node_modules")
    )) {
        if (Remove-IfPresent -PathValue $nodeModulesPath -Label "node_modules") {
            $removedPaths.Add($nodeModulesPath)
        }
    }
}

if ($IncludeVenv.IsPresent) {
    Write-Step "Removing backend virtual environment"
    $venvPath = Join-Path $repoRoot "server-fastapi\venv"
    if (Remove-IfPresent -PathValue $venvPath -Label "virtual environment") {
        $removedPaths.Add($venvPath)
    }
}

Write-Host ""
Write-Host "Cleanup completed." -ForegroundColor Green
Write-Host "Removed directories/files: $($removedPaths.Count)"
Write-Host "Removed __pycache__/.cache directories: $removedPyCaches"
Write-Host "Removed Python bytecode files: $removedPyFiles"
Write-Host "Removed .tsbuildinfo files: $removedTsBuildInfo"

if ($removedPaths.Count -eq 0 -and $removedPyCaches -eq 0 -and $removedPyFiles -eq 0 -and $removedTsBuildInfo -eq 0) {
    Write-Host "Nothing matched the cleanup rules."
}
