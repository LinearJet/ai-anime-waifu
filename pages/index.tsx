// pages/index.tsx

import type { NextPage } from 'next';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import styles from '../styles/Home.module.css';
import fs from 'fs';
import path from 'path';

const VrmViewer = dynamic(
  () => import('../components/VrmViewer').then((mod) => mod.VrmViewer),
  { ssr: false }
);

type HomeProps = {
  animationFiles: string[];
};

const Home: NextPage<HomeProps> = ({ animationFiles }) => {
  return (
    <div className={styles.container}>
      <Head>
        <title>Next.js VRM Viewer</title>
        <meta name="description" content="VRM Loader and Animation Adder in Next.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <VrmViewer animationFiles={animationFiles} />
      </main>
    </div>
  );
};

export default Home;

export async function getStaticProps() {
  const animationsDirectory = path.join(process.cwd(), 'public', 'animations');
  let animationFiles: string[] = [];

  console.log(`--- Animation Loader ---`);
  console.log(`Attempting to read directory: ${animationsDirectory}`);

  try {
    // Check if the directory exists
    if (!fs.existsSync(animationsDirectory)) {
      throw new Error(`Directory not found.`);
    }

    const allFilenames = fs.readdirSync(animationsDirectory);
    console.log(`Found ${allFilenames.length} files: [${allFilenames.join(', ')}]`);

    animationFiles = allFilenames.filter(
      (file) => file.endsWith('.fbx') || file.endsWith('.glb')
    );
    
    console.log(`Filtered to ${animationFiles.length} supported animation files.`);

  } catch (error) {
    console.warn(`[WARNING] Could not read animations directory: ${(error as Error).message}`);
    console.warn('Please create "public/animations" and add .fbx or .glb files to enable the dropdown.');
  }
  
  console.log(`--- End Animation Loader ---\n`);

  return {
    props: {
      animationFiles,
    },
  };
}