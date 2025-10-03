import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility class for managing image files and cleaning up old screenshots
 */
export class ImageCleanup {
    private static readonly IMAGE_DIRECTORIES = [
        'alerts',
        'debug',
        'evidence'
    ];

    /**
     * Clean up all old images from specified directories
     */
    static cleanupOldImages(): void {
        console.log('🧹 Cleaning up old images...');
        
        for (const dir of this.IMAGE_DIRECTORIES) {
            const dirPath = path.join(process.cwd(), dir);
            
            if (fs.existsSync(dirPath)) {
                try {
                    const files = fs.readdirSync(dirPath);
                    const imageFiles = files.filter(file => 
                        file.toLowerCase().endsWith('.png') || 
                        file.toLowerCase().endsWith('.jpg') || 
                        file.toLowerCase().endsWith('.jpeg')
                    );
                    
                    if (imageFiles.length > 0) {
                        console.log(`🗑️ Removing ${imageFiles.length} old images from ${dir}/`);
                        
                        for (const file of imageFiles) {
                            const filePath = path.join(dirPath, file);
                            fs.unlinkSync(filePath);
                        }
                    } else {
                        console.log(`✅ No old images found in ${dir}/`);
                    }
                } catch (error) {
                    console.error(`❌ Error cleaning up ${dir}/:`, error);
                }
            } else {
                console.log(`📁 Directory ${dir}/ doesn't exist, skipping cleanup`);
            }
        }
        
        console.log('✅ Image cleanup completed');
    }

    /**
     * Clean up old images from a specific directory
     */
    static cleanupDirectory(dirName: string): void {
        const dirPath = path.join(process.cwd(), dirName);
        
        if (fs.existsSync(dirPath)) {
            try {
                const files = fs.readdirSync(dirPath);
                const imageFiles = files.filter(file => 
                    file.toLowerCase().endsWith('.png') || 
                    file.toLowerCase().endsWith('.jpg') || 
                    file.toLowerCase().endsWith('.jpeg')
                );
                
                if (imageFiles.length > 0) {
                    console.log(`🗑️ Removing ${imageFiles.length} old images from ${dirName}/`);
                    
                    for (const file of imageFiles) {
                        const filePath = path.join(dirPath, file);
                        fs.unlinkSync(filePath);
                    }
                }
            } catch (error) {
                console.error(`❌ Error cleaning up ${dirName}/:`, error);
            }
        }
    }

    /**
     * Keep only the most recent N images in a directory
     */
    static keepRecentImages(dirName: string, keepCount: number = 1): void {
        const dirPath = path.join(process.cwd(), dirName);
        
        if (!fs.existsSync(dirPath)) {
            return;
        }

        try {
            const files = fs.readdirSync(dirPath);
            const imageFiles = files.filter(file => 
                file.toLowerCase().endsWith('.png') || 
                file.toLowerCase().endsWith('.jpg') || 
                file.toLowerCase().endsWith('.jpeg')
            );

            if (imageFiles.length <= keepCount) {
                return;
            }

            // Sort by modification time (newest first)
            const fileStats = imageFiles.map(file => ({
                name: file,
                path: path.join(dirPath, file),
                mtime: fs.statSync(path.join(dirPath, file)).mtime
            })).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

            // Remove all but the most recent files
            const filesToDelete = fileStats.slice(keepCount);
            
            if (filesToDelete.length > 0) {
                console.log(`🗑️ Removing ${filesToDelete.length} old images from ${dirName}/ (keeping ${keepCount} most recent)`);
                
                for (const file of filesToDelete) {
                    fs.unlinkSync(file.path);
                }
            }
        } catch (error) {
            console.error(`❌ Error managing images in ${dirName}/:`, error);
        }
    }
}
