# Export/Import Feature

## Overview
Added a comprehensive backup and restore feature that allows users to export and import their database and configuration settings.

## Features

### Export Functionality
- **Endpoint**: `GET /api/export`
- **Format**: ZIP file containing:
  - `database.sqlite` - Complete ping history and monitoring data
  - `config.json` - Network configuration (areas, devices, links, settings)
- **Filename**: `map-ping-backup-YYYY-MM-DD.zip`
- **Usage**: One-click download from the Settings page

### Import Functionality
- **Endpoint**: `POST /api/import`
- **Format**: ZIP file (previously exported backup)
- **Safety Features**:
  - Automatic backup of current data before import
  - Validation of uploaded file contents
  - Confirmation prompt before replacing data
  - Automatic monitoring restart after import
- **Backup Location**: `backend/data/backup-{timestamp}/`

## Implementation Details

### Backend Changes

#### New Dependencies
```json
{
  "archiver": "^6.0.1",      // Creates ZIP files for export
  "multer": "^1.4.5-lts.1",  // Handles file uploads for import
  "extract-zip": "^2.0.1"    // Extracts uploaded ZIP files
}
```

#### New API Endpoints

**Export Endpoint** (`backend/server.js:79-123`)
- Validates database and config files exist
- Creates ZIP archive on-the-fly
- Streams ZIP file to client
- No temporary files created

**Import Endpoint** (`backend/server.js:126-210`)
- Accepts multipart/form-data with ZIP file
- Validates ZIP contents
- Creates automatic backup of current data
- Stops monitoring during import
- Replaces database and config files
- Restarts monitoring with new config
- Cleans up temporary files

### Frontend Changes

#### API Client (`frontend/lib/api.ts:141-160`)
```typescript
exportData: async (): Promise<Blob>
importData: async (file: File): Promise<{ success: boolean, message: string }>
```

#### Settings Page UI (`frontend/app/settings/page.tsx`)

**New State Variables**:
- `isExporting`: boolean - Export in progress indicator
- `isImporting`: boolean - Import in progress indicator

**New Functions**:
- `handleExport()`: Downloads backup ZIP file
- `handleImport(e)`: Uploads and restores from ZIP file

**New UI Section**: "Backup & Restore" Card
- Export button with loading state
- Import button with file picker
- Info box explaining functionality
- Success/error messages
- Responsive design (mobile-friendly)

## User Experience

### Export Process
1. User clicks "Export Data" button
2. Button shows loading state
3. ZIP file downloads automatically
4. Success message displays
5. Filename includes current date

### Import Process
1. User clicks "Import Data" button
2. File picker opens (accepts .zip only)
3. Confirmation dialog appears
4. Button shows loading state during upload
5. Current data automatically backed up
6. New data imported and monitoring restarts
7. Success message displays
8. Page reloads with new configuration

## Security & Safety

### Data Protection
- ✅ Automatic backup before import
- ✅ File validation (checks for required files)
- ✅ User confirmation required
- ✅ Transaction-like behavior (backup before replace)

### Error Handling
- ✅ Invalid file format detection
- ✅ Missing file validation
- ✅ Cleanup on error
- ✅ User-friendly error messages

## File Structure

```
backend/
  ├── data/
  │   ├── database.sqlite      (current database)
  │   ├── config.json          (current config)
  │   ├── backup-{timestamp}/  (auto backups on import)
  │   └── temp/                (temporary upload directory)
  └── server.js                (export/import endpoints)

frontend/
  ├── app/settings/page.tsx    (backup & restore UI)
  └── lib/api.ts               (API client methods)
```

## Testing

### Manual Testing Steps
1. **Export Test**:
   - Go to Settings page
   - Click "Export Data"
   - Verify ZIP file downloads
   - Extract and verify contents (database.sqlite + config.json)

2. **Import Test**:
   - Make changes to configuration
   - Import a previous backup
   - Verify data is restored
   - Check that backup was created in `backend/data/backup-*`

3. **Error Handling Test**:
   - Try importing invalid file
   - Try importing non-ZIP file
   - Verify error messages display

## Usage Example

```bash
# Access the application
http://localhost:3000/settings

# Export: Click "Export Data" button
# → Downloads: map-ping-backup-2025-10-22.zip

# Import: Click "Import Data", select backup.zip
# → Current data backed up to: backend/data/backup-1729612345678/
# → Imported data replaces current data
# → Monitoring restarts automatically
```

## Technical Notes

### Why ZIP Format?
- Contains both database and config in one file
- Widely supported and easy to extract
- Compressed for faster transfer
- Human-readable structure

### Backup Strategy
- Import creates timestamped backup folder
- Original files preserved before replacement
- Multiple backups accumulate (manual cleanup recommended)
- Backup location logged in import response

### Monitoring Management
- Monitoring stops before import
- Prevents data conflicts during file replacement
- Automatically restarts with new configuration
- No manual intervention required

## Future Enhancements

Potential improvements:
- [ ] Scheduled automatic backups
- [ ] Backup history management
- [ ] Selective import (config only, database only)
- [ ] Cloud backup integration
- [ ] Backup encryption
- [ ] Restore point preview before import
- [ ] Backup size limit warnings

## Changelog

**2025-10-22**: Initial implementation
- Added export/import endpoints to backend
- Added backup & restore UI to settings page
- Installed required npm packages
- Implemented automatic backup before import
- Added file validation and error handling

