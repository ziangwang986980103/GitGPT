import fs from 'fs';
import path from 'path';
import dependencyTree from 'dependency-tree';

const directoryPath = '/mnt/c/users/zang/desktop/gamma-dev/gamma/src/extension';
const allTrees = {};

function getDependencyTree(filePath) {
    return dependencyTree({
        filename: filePath,
        directory: directoryPath,
        filter: path => path.indexOf('node_modules') === -1,
    });
}

function traverseDirectory(directoryPath) {
    const files = fs.readdirSync(directoryPath);

    files.forEach(file => {
        const fullPath = path.join(directoryPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            traverseDirectory(fullPath); // Recursively traverse if directory
        } else if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx')) {
            const temp = getDependencyTree(fullPath);
            allTrees[fullPath] = temp[fullPath]; // Generate tree if valid file
        }
    });
}

traverseDirectory(directoryPath);
console.log(allTrees);
// 'allTrees' now contains the dependency trees for all valid files in the directory.
