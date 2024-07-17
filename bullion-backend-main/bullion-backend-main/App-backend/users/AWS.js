const aws = require('aws-sdk');

class AWS {
    constructor() {
        this.AWS_ACCESS    = process.env.AWS_IAM_ACCESS_ID;
        this.AWS_SECRET    = process.env.AWS_IAM_SECRET;
        this.aws = aws;
        this.aws.config = new aws.Config(
            {
                accessKeyId: this.AWS_ACCESS,
                secretAccessKey: this.AWS_SECRET
            }
        );
    };
};

// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
class S3 extends AWS {
    constructor() {
        super();    
        this.BUCKET_NAME   = process.env.AWS_S3_BUCKET_NAME;
        this.s3 = new this.aws.S3();
    };

    createUploadParams(uploadPath, file, contentType) {
        return {
            Bucket: this.BUCKET_NAME,
            Key: uploadPath,
            Body: file,
            ContentType: contentType
        };
    };

    /**
     * 
     * @param {*} params 
     * @param {*} options 
     * @returns {
     *  Location: URL
     *  ETag
     * }
     */
    upload(params, options = {}) {
        return new Promise((resolve, reject) => {
            this.s3.upload(params, options, function(err, data) {
                if (err) return reject(err);
                resolve(data);
            })
        });
    };
};

module.exports = {
    S3
};