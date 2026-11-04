<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;
use ZipArchive;

class BackupService
{
    public function directory(): string
    {
        $path = storage_path('app/backups');
        File::ensureDirectoryExists($path);

        return $path;
    }

    /**
     * @return list<array{name: string, size: int, created_at: string, path: string}>
     */
    public function list(): array
    {
        return collect(File::files($this->directory()))
            ->filter(fn ($file) => in_array(strtolower($file->getExtension()), ['sql', 'zip'], true))
            ->sortByDesc(fn ($file) => $file->getMTime())
            ->values()
            ->map(fn ($file) => [
                'name' => $file->getFilename(),
                'size' => $file->getSize(),
                'created_at' => date('c', $file->getMTime()),
                'path' => $file->getPathname(),
            ])
            ->all();
    }

    /**
     * Create a SQL dump (+ optional storage zip) and return the primary file meta.
     *
     * @return array{name: string, size: int, created_at: string, path: string}
     */
    public function create(bool $includeStorage = false): array
    {
        $stamp = now()->format('Ymd_His');
        $sqlName = "afc_db_{$stamp}.sql";
        $sqlPath = $this->directory().DIRECTORY_SEPARATOR.$sqlName;
        File::put($sqlPath, $this->buildSqlDump());

        $resultPath = $sqlPath;
        $resultName = $sqlName;

        if ($includeStorage) {
            $zipName = "afc_full_{$stamp}.zip";
            $zipPath = $this->directory().DIRECTORY_SEPARATOR.$zipName;
            $zip = new ZipArchive;
            if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
                throw new RuntimeException('Unable to create backup zip archive.');
            }
            $zip->addFile($sqlPath, $sqlName);
            $this->addDirectoryToZip($zip, storage_path('app/public'), 'storage/public');
            $zip->close();
            File::delete($sqlPath);
            $resultPath = $zipPath;
            $resultName = $zipName;
        }

        return [
            'name' => $resultName,
            'size' => File::size($resultPath),
            'created_at' => now()->toIso8601String(),
            'path' => $resultPath,
        ];
    }

    public function absolutePath(string $name): string
    {
        $safe = basename($name);
        $path = $this->directory().DIRECTORY_SEPARATOR.$safe;
        if (! File::exists($path) || ! Str::startsWith(realpath($path) ?: '', realpath($this->directory()) ?: '___')) {
            throw new RuntimeException('Backup file not found.');
        }

        return $path;
    }

    public function delete(string $name): void
    {
        File::delete($this->absolutePath($name));
    }

    private function buildSqlDump(): string
    {
        $connection = config('database.default');
        $database = (string) config("database.connections.{$connection}.database");
        $lines = [
            '-- AFC POS backup',
            '-- Generated: '.now()->toDateTimeString(),
            '-- Database: '.$database,
            'SET FOREIGN_KEY_CHECKS=0;',
            '',
        ];

        $tables = collect(DB::select('SHOW TABLES'))
            ->map(fn ($row) => array_values((array) $row)[0])
            ->filter()
            ->values();

        foreach ($tables as $table) {
            $create = DB::selectOne('SHOW CREATE TABLE `'.$table.'`');
            $createSql = array_values((array) $create)[1] ?? null;
            $lines[] = 'DROP TABLE IF EXISTS `'.$table.'`;';
            if ($createSql) {
                $lines[] = $createSql.';';
            }
            $lines[] = '';

            $rows = DB::table($table)->get();
            foreach ($rows as $row) {
                $values = collect((array) $row)->map(function ($value) {
                    if ($value === null) {
                        return 'NULL';
                    }
                    if (is_bool($value)) {
                        return $value ? '1' : '0';
                    }
                    if (is_numeric($value) && ! is_string($value)) {
                        return (string) $value;
                    }

                    return "'".str_replace(['\\', "'"], ['\\\\', "\\'"], (string) $value)."'";
                })->implode(', ');
                $columns = collect((array) $row)->keys()->map(fn ($col) => '`'.$col.'`')->implode(', ');
                $lines[] = "INSERT INTO `{$table}` ({$columns}) VALUES ({$values});";
            }
            $lines[] = '';
        }

        $lines[] = 'SET FOREIGN_KEY_CHECKS=1;';

        return implode("\n", $lines);
    }

    private function addDirectoryToZip(ZipArchive $zip, string $directory, string $zipPrefix): void
    {
        if (! File::isDirectory($directory)) {
            return;
        }

        foreach (File::allFiles($directory) as $file) {
            $relative = $zipPrefix.'/'.ltrim(str_replace('\\', '/', Str::after($file->getPathname(), $directory)), '/');
            $zip->addFile($file->getPathname(), $relative);
        }
    }
}
