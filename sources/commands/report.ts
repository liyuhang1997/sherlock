import Octokit               from '@octokit/rest';
import {Command, UsageError} from 'clipanion';
import {readFileSync}        from 'fs';

import {CONTEXT_FILE, RESULT_FILE}                                               from '../constants';
import {LABEL_REPRODUCIBLE, LABEL_BROKEN, LABEL_UNREPRODUCIBLE, SHERLOCK_LABELS} from '../constants';
import {COMMENT_BODIES}                                                          from '../constants';
import {Context}                                                                 from '../types';

export class ReportCommand extends Command {
    @Command.Path(`report`)
    async execute() {
        if (!process.env.GITHUB_TOKEN)
            throw new UsageError(`Missing GitHub token in the environment`);

        const context = JSON.parse(readFileSync(CONTEXT_FILE, `utf8`)) as Context;
        const {assertion, error} = JSON.parse(readFileSync(RESULT_FILE, `utf8`));

        const labels = new Set(context.labels);

        const label = assertion
            ? LABEL_REPRODUCIBLE
            : error
            ? LABEL_BROKEN
            : LABEL_UNREPRODUCIBLE;

        for (const label of SHERLOCK_LABELS)
            labels.delete(label);

        labels.add(label);

        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
        });

        await octokit.issues.update({
            owner: context.owner,
            repo: context.repository,
            issue_number: context.issue,
            labels: [...labels],
        });

        await octokit.issues.createComment({
            owner: context.owner,
            repo: context.repository,
            issue_number: context.issue,
            body: COMMENT_BODIES.get(label)!({assertion, error}),
        });

        if (error) {
            this.context.stdout.write(error);
        }
    }
}