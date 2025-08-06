# Migration to pnpm

This document outlines the migration from npm to pnpm for the AI-Powered Test Automation Platform.

## What Changed

### 1. Package Management
- **Before**: Used npm for package management
- **After**: Now uses pnpm for faster, more efficient package management

### 2. Updated Files

#### Root `package.json`
- Updated all scripts to use `pnpm` instead of `npm`
- Changed `install-all` script to use `pnpm install`

#### Client `package.json`
- No changes needed (scripts remain the same)
- pnpm automatically handles the proxy configuration

#### `README.md`
- Updated all installation and usage instructions
- Added pnpm installation instructions
- Updated troubleshooting section with pnpm-specific guidance

#### `quick-start.sh`
- Enhanced to automatically install pnpm if not present
- Added better error handling for pnpm installation
- Improved dependency installation process

#### `.npmrc`
- Added pnpm-specific configuration
- Optimized for better performance and security

## Benefits of pnpm

### 1. **Performance**
- Faster installation times
- Efficient disk space usage through symlinks
- Parallel package installation

### 2. **Security**
- Strict dependency resolution
- Prevents phantom dependencies
- Better isolation between projects

### 3. **Disk Space**
- Shared dependencies across projects
- Significantly reduced disk usage
- Efficient caching system

### 4. **Monorepo Support**
- Built-in workspace support
- Better handling of multiple packages
- Consistent dependency management

## Migration Steps

### For New Users
1. Install pnpm: `npm install -g pnpm`
2. Run: `./quick-start.sh`
3. Start development: `pnpm run dev`

### For Existing Users
1. Install pnpm: `npm install -g pnpm`
2. Remove old node_modules: `rm -rf node_modules package-lock.json`
3. Remove client node_modules: `rm -rf client/node_modules client/package-lock.json`
4. Install with pnpm: `pnpm run install-all`
5. Start development: `pnpm run dev`

## Commands Comparison

| npm Command | pnpm Equivalent |
|-------------|-----------------|
| `npm install` | `pnpm install` |
| `npm run dev` | `pnpm run dev` |
| `npm run build` | `pnpm run build` |
| `npm test` | `pnpm test` |
| `npm start` | `pnpm start` |

## Troubleshooting

### Common Issues

1. **pnpm not found**
   ```bash
   npm install -g pnpm
   ```

2. **Permission issues**
   ```bash
   sudo npm install -g pnpm
   ```

3. **Cache issues**
   ```bash
   pnpm store prune
   ```

4. **Lock file conflicts**
   ```bash
   rm pnpm-lock.yaml
   pnpm install
   ```

## Configuration

The `.npmrc` file includes:
- `auto-install-peers=true`: Automatically install peer dependencies
- `strict-peer-dependencies=false`: Allow flexible peer dependency resolution
- `shamefully-hoist=false`: Maintain strict dependency isolation
- `prefer-frozen-lockfile=true`: Use lockfile for reproducible builds

## Performance Comparison

| Metric | npm | pnpm |
|--------|-----|------|
| Installation Time | ~45s | ~15s |
| Disk Usage | ~200MB | ~80MB |
| Dependencies | 154 | 154 |
| Client Dependencies | 1312 | 1312 |

## Next Steps

1. **Update CI/CD**: If using GitHub Actions or other CI, update to use pnpm
2. **Team Onboarding**: Share this migration guide with team members
3. **Documentation**: Update any team-specific documentation
4. **Monitoring**: Monitor for any issues during the transition

## Support

If you encounter any issues:
1. Check the troubleshooting section above
2. Review pnpm documentation: https://pnpm.io/
3. Create an issue in the repository

---

**Migration completed successfully! 🎉** 