#!/usr/bin/env node

import path from 'path';
import fs from  'fs/promises'
import chalk from 'chalk';
import { Command } from 'commander';
import crypto from 'crypto'

import { diffLines } from 'diff';

const program= new Command();

class Grit{
    constructor(repoPath='.'){
        // console.log("working")
        this.repoPath=path.join(repoPath,'.grit');
        this.objectPath=path.join(this.repoPath,"objects");
       this.headPath=path.join(this.repoPath,'HEAD');
       this.indexPath=path.join(this.repoPath,'index');
       this.init();
    }

    async init(){
   await fs.mkdir(this.objectPath, {recursive:true});
   try{
      await fs.writeFile(this.headPath,"",{flag:'wx'});
      await fs.writeFile(this.indexPath,JSON.stringify([]),{flag:'wx'});
   } catch(err){
    console.log("already initialized");
   }
    }
    hashObject(content){
        return crypto.createHash('sha1').update(content,'utf-8').digest('hex')
          }
      
          async add(fileToBeAdded){
            
      const fileData=await fs.readFile(fileToBeAdded, {encoding : 'utf-8'});
      const fileHash =this.hashObject(fileData);
      console.log(fileHash);
      const newFileHashedObjectPath=path.join(this.objectPath, fileHash);
      try{
      await fs.writeFile(newFileHashedObjectPath, fileData);
      }catch(err){
        console.log(err);
      }

      //adding to staging area  
      try{

      
    await this.updateStagingArea(fileToBeAdded,fileHash);
      }catch(err){

      }
    console.log(`Added ${fileToBeAdded}`);
        
      
    
    

}

          

    async updateStagingArea(filePath, fileHash){
          let data="";
          try{
               data=await fs.readFile(this.indexPath, {encoding:'utf-8'});
          }catch(err){ 
            console.log(err);
          }
const index=JSON.parse(data);
index.push({path : filePath, hash :fileHash});
try{
  await fs.writeFile(this.indexPath, JSON.stringify(index))
}catch(err){
  console.log(err);
}
console.log("staged");

    

}

async commit(message){
    let data="";
    try{
         data=await fs.readFile(this.indexPath, {encoding:'utf-8'});
    }catch(err){ 
      console.log(err);
    }
const index=JSON.parse(data);
const parentCommit=await this.getCurrentHead();

const commitData ={
timeStamp : new Date().toISOString(),
message,
files : index,
parent:parentCommit


}
const commitHash=this.hashObject(JSON.stringify(commitData));
const commitPath=path.join(this.objectPath, commitHash)
try{
await fs.writeFile(commitPath,JSON.stringify(commitData));
await fs.writeFile(this.headPath,commitHash);
await fs.writeFile(this.indexPath, JSON.stringify([]));
} catch(err){}
console.log(`successfully created ${commitHash} `);
}

async getCurrentHead(){
    try{
        return await fs.readFile(this.headPath, {encoding:'utf-8'})
    }
    catch(err){
  return null;
    }
}

async log(){
    let currentCommitHash=await this.getCurrentHead();
    console.log("logs :")
    while(currentCommitHash){
        const commitData= JSON.parse(await fs.readFile(path.join(this.objectPath,currentCommitHash),{encoding:'utf-8'}))
        console.log(`Commit : ${currentCommitHash}\nDate:${commitData.timeStamp}\n\n${commitData.message}`);
        console.log("----------------------------------------------")
        currentCommitHash=commitData.parent;
    }
}

async showCommitDiff(commitHash){
const commitData=JSON.parse(await this.getComData(commitHash));
if(!commitData){
    console.log("Commit Not found");
    return;
}
console.log("Changes in the last commmit are : ");
  for(const file of commitData.files) {
    console.log(`File : ${file.path}`);
    const fileContent =await this.getFileContent(file.hash);
    console.log(fileContent)
    if(commitData.parent){
        const parentCommitData=JSON.parse(await this.getComData(commitData.parent));
        const getParentFileContent=await this.getParentFileContent(parentCommitData,file.path)

        if(getParentFileContent!==undefined){
            console.log("\nDiff : ");
            const diff = diffLines(getParentFileContent,fileContent);
            // console.log(diff);

            diff.forEach((part)=>{
                if(part.added){
                  process.stdout.write(chalk.green("++"+part.value));
                }else if(part.removed){
                  process.stdout.write(chalk.red("--"+part.value));
                }
                else{
                  process.stdout.write(chalk.grey(part.value));
                }
            })
            console.log();
        }
        else{
            console.log("New File Commit")
        }
    }
    else console.log("First comm");
  }

}

async getComData(commitHash){
   let commitPath=path.join(this.objectPath,commitHash);

   try{
    return await fs.readFile(commitPath,{encoding:'utf-8'});
   }
   catch(err){
    console.log("failed to read data",err);
   }
}

async getFileContent(fileHash){
    try{
        return await fs.readFile(path.join(this.objectPath,fileHash),{encoding:'utf-8'});
    }catch(err){

    }
}

async getParentFileContent(parentCommitData, filePath){
    const parentFile=parentCommitData.files.find(file => file.path===filePath)

    if(parentFile){
        return await this.getFileContent(parentFile.hash);
    }

}

}


// (async ()=>{
//     const grit=new Grit();
//    await  grit.add('sample2.txt');
//     await grit.commit(' latest  commit');
//     await grit.log();
//     await grit.showCommitDiff("f4bc61f9ba661bd6e5c45dd1e49515e8297a7cd6")


// })();

program.command('init').action(async ()=>{
  const grit=new Grit();
})

program.command('add <file>').action(async (file)=>{
  const grit=new Grit();
  await grit.add(file);
})

program.command('commit <message>').action(async (message)=>{
  const grit=new Grit();
 await  grit.commit(message);
})

program.command('log').action(async ()=>{
  const grit=new Grit();
  await grit.log();
})

program.command('show <commitHash>').action(async (commitHash)=>{
  const grit=new Grit();
  await grit.showCommitDiff(commitHash);
})

program.parse(process.argv);