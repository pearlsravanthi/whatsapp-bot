#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { initWhatsApp, getChannels, sendTextToChannel, sendImageToChannel } from './bot/whatsapp.js';
import logger from './utils/logger.js';

const program = new Command();

program
    .name('whatsapp-cli')
    .description('WhatsApp Channel Bot CLI')
    .version('1.0.0');

program
    .command('list-channels')
    .description('List all your channels')
    .action(async () => {
        try {
            await initWhatsApp();

            // Wait for connection
            await new Promise(resolve => setTimeout(resolve, 5000));

            const channels = await getChannels();

            console.log('\n=== Your Channels ===');
            if (channels.length === 0) {
                console.log('No channels found.');
            } else {
                channels.forEach((channel, index) => {
                    console.log(`\n${index + 1}. ${channel.name}`);
                    console.log(`   ID: ${channel.id}`);
                    console.log(`   Description: ${channel.description || 'N/A'}`);
                });
            }

            process.exit(0);
        } catch (error) {
            logger.error('Error:', error);
            process.exit(1);
        }
    });

program
    .command('send-message')
    .description('Send text message to channel')
    .requiredOption('-c, --channel <channelId>', 'Channel ID')
    .requiredOption('-t, --text <message>', 'Message text')
    .action(async (options) => {
        try {
            await initWhatsApp();

            // Wait for connection
            await new Promise(resolve => setTimeout(resolve, 5000));

            await sendTextToChannel(options.channel, options.text);

            console.log('✅ Message sent successfully!');
            process.exit(0);
        } catch (error) {
            logger.error('Error:', error);
            process.exit(1);
        }
    });

program
    .command('send-image')
    .description('Send image to channel')
    .requiredOption('-c, --channel <channelId>', 'Channel ID')
    .requiredOption('-u, --url <imageUrl>', 'Image URL')
    .option('-cap, --caption <caption>', 'Image caption', '')
    .action(async (options) => {
        try {
            await initWhatsApp();

            // Wait for connection
            await new Promise(resolve => setTimeout(resolve, 5000));

            await sendImageToChannel(options.channel, options.url, options.caption);

            console.log('✅ Image sent successfully!');
            process.exit(0);
        } catch (error) {
            logger.error('Error:', error);
            process.exit(1);
        }
    });

program.parse();